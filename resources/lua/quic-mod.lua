-- quic-mod.lua
-- zapret2 / LuaJIT 5.1, только встроенные C-функции nfqws2 + zapret-lib
--
-- quic_mod(blob, modlist[, payload])
--   blob     - UDP payload QUIC Initial (как files/fake/quic_initial_*.bin)
--   payload  - оригинальный ClientHello (desync.decrypt_data), нужен только для dupsid
--   modlist  - через запятую:
--     rndcid          - рандом DCID и SCID (длины те же)
--     rnddcid,rndscid - по отдельности
--     rnd             - TLS random + session_id (через tls_mod)
--     rndsni          - случайный SNI той же длины
--     sni=host        - конкретный SNI (длина может измениться, ест PADDING)
--     dupsid          - скопировать session_id из payload
--
-- длина датаграммы сохраняется

local function hmac_sha256(key, data)
	if #key > 64 then key = hash("sha256", key) end
	if #key < 64 then key = key .. string.rep("\0", 64 - #key) end
	local ipad = bxor(key, string.rep(string.char(0x36), 64))
	local opad = bxor(key, string.rep(string.char(0x5c), 64))
	return hash("sha256", opad .. hash("sha256", ipad .. data))
end

local function hkdf_expand(prk, info, len)
	local t, okm, i = "", "", 1
	while #okm < len do
		t = hmac_sha256(prk, t .. info .. string.char(i))
		okm = okm .. t
		i = i + 1
	end
	return string.sub(okm, 1, len)
end

-- как в protocol.c: label уже с префиксом "tls13 "
local function quic_expand_label(secret, label, len)
	local info = bu16(len) .. bu8(#label) .. label .. "\0"
	return hkdf_expand(secret, info, len)
end

local _salts
local function quic_salt(ver)
	if not _salts then
		_salts = {
			v1  = parse_hex("38762cf7f55934b34d179ae6a4c80cadccbb7f0a"),
			v2  = parse_hex("0dede3def700a6db819381be6e269dcbf9bd2ed9"),
			d22 = parse_hex("7fbcbd0e7c66bbe9193a96cd21519ebd7a02644a"),
			d23 = parse_hex("c3eef712c72ebb5a11a7d2432bb46365bef9f502"),
			d29 = parse_hex("afbfec289993d24c9e9786f19c6111e04390a899"),
		}
	end
	if ver == 1 then return _salts.v1 end
	if ver == 0x6b3343cf or ver == 0x709A50C4 then return _salts.v2 end
	if bitrshift(ver, 8) == 0xff0000 then
		local d = bitand(ver, 0xFF)
		if d <= 22 then return _salts.d22 end
		if d <= 28 then return _salts.d23 end
		if d <= 32 then return _salts.d29 end
		return _salts.v1
	end
	if ver == 0xfaceb001 then return _salts.d22 end
	if ver == 0xfaceb002 or ver == 0xfaceb00e then return _salts.d23 end
	return _salts.v1
end

local function is_quic_v2(ver)
	return ver == 0x6b3343cf or ver == 0x709A50C4
end

local function initial_keys(dcid, ver)
	local salt = quic_salt(ver)
	local initial = hmac_sha256(salt, dcid)
	local client_in = quic_expand_label(initial, "tls13 client in", 32)
	local klabel = is_quic_v2(ver) and "tls13 quicv2 key" or "tls13 quic key"
	local ilabel = is_quic_v2(ver) and "tls13 quicv2 iv"  or "tls13 quic iv"
	local hlabel = is_quic_v2(ver) and "tls13 quicv2 hp"  or "tls13 quic hp"
	return {
		key = quic_expand_label(client_in, klabel, 16),
		iv  = quic_expand_label(client_in, ilabel, 12),
		hp  = quic_expand_label(client_in, hlabel, 16),
	}
end

local function be8(n)
	local t = {}
	for i = 8, 1, -1 do
		t[i] = n % 256
		n = math.floor(n / 256)
	end
	return string.char(unpack(t))
end

local function nonce_from_iv(iv, pn)
	return string.sub(iv, 1, 4) .. bxor(string.sub(iv, 5, 12), be8(pn))
end

local function parse_mods(modlist)
	local m = { tls = {} }
	if not modlist or modlist == "" or modlist == "none" then return m end
	for opt in string.gmatch(modlist, "[^,]+") do
		local k, v = string.match(opt, "^([^=]+)=(.*)$")
		k = k or opt
		if k == "rndcid" then
			m.dcid, m.scid = true, true
		elseif k == "rnddcid" then
			m.dcid = true
		elseif k == "rndscid" then
			m.scid = true
		elseif k == "rnd" or k == "rndsni" or k == "dupsid" or k == "padencap" then
			m.tls[#m.tls + 1] = k
		elseif k == "sni" then
			if not v or v == "" then return nil, "sni= requires host" end
			m.tls[#m.tls + 1] = "sni=" .. v
		elseif k ~= "none" then
			return nil, "unknown mod '" .. k .. "'"
		end
	end
	m.tls_list = table.concat(m.tls, ",")
	return m
end

local function parse_initial(pkt)
	if #pkt < 20 or bitand(u8(pkt, 1), 0x80) == 0 then return nil, "not long header" end
	local ver = u32(pkt, 2)
	local i = 6
	local dcid_len = u8(pkt, i); i = i + 1
	if dcid_len < 1 or dcid_len > 20 or i + dcid_len - 1 > #pkt then return nil, "bad dcid" end
	local dcid = string.sub(pkt, i, i + dcid_len - 1); i = i + dcid_len
	local scid_len = u8(pkt, i); i = i + 1
	if scid_len > 20 or i + scid_len - 1 > #pkt then return nil, "bad scid" end
	local scid = string.sub(pkt, i, i + scid_len - 1); i = i + scid_len
	local token_len, n1 = quic_tvb(pkt, i)
	if not token_len then return nil, "bad token_len" end
	i = i + n1
	local token = string.sub(pkt, i, i + token_len - 1); i = i + token_len
	local length, n2 = quic_tvb(pkt, i)
	if not length then return nil, "bad length" end
	i = i + n2
	if length < 20 or i + length - 1 > #pkt then return nil, "truncated" end
	return {
		ver = ver, dcid = dcid, scid = scid, token = token,
		length = length, length_nlen = n2, token_nlen = n1,
		pn_off = i, pkt_end = i + length - 1,
	}
end

local function decrypt_initial(pkt, hdr, keys)
	local sample = string.sub(pkt, hdr.pn_off + 4, hdr.pn_off + 19)
	if #sample ~= 16 then return nil, "no sample" end
	local mask = aes(true, keys.hp, sample)
	if not mask then return nil, "hp aes failed" end
	local first = bitxor(u8(pkt, 1), bitand(u8(mask, 1), 0x0F))
	local pn_len = bitand(first, 3) + 1
	local pn, pb = 0, {}
	for j = 1, pn_len do
		local b = bitxor(u8(pkt, hdr.pn_off + j - 1), u8(mask, j + 1))
		pb[j] = b
		pn = pn * 256 + b
	end
	local pn_raw = string.char(unpack(pb))
	local aad = bu8(first) .. string.sub(pkt, 2, hdr.pn_off - 1) .. pn_raw
	local body = string.sub(pkt, hdr.pn_off + pn_len, hdr.pkt_end)
	if #body < 16 then return nil, "short body" end
	local ct, tag = string.sub(body, 1, #body - 16), string.sub(body, #body - 15)
	local pt, atag = aes_gcm(false, keys.key, nonce_from_iv(keys.iv, pn), ct, aad)
	if not pt or atag ~= tag then return nil, "gcm decrypt/tag" end
	return { first = first, pn = pn, pn_len = pn_len, pn_raw = pn_raw, plain = pt }
end

local function encrypt_initial(hdr, up, keys, dcid, scid, plain)
	local first = bitor(bitand(up.first, 0xFC), up.pn_len - 1)
	first = bitand(first, 0xF3) -- reserved bits 0
	first = bitor(first, up.pn_len - 1)
	local length = up.pn_len + #plain + 16
	local hdr_u =
		bu8(first) ..
		bu32(hdr.ver) ..
		bu8(#dcid) .. dcid ..
		bu8(#scid) .. scid ..
		bquic_tvb(#hdr.token) .. hdr.token ..
		bquic_tvb(length) ..
		up.pn_raw
	-- если varint Length сменил ширину — добиваем исходной шириной
	-- (при тех же CID-длинах и том же plaintext обычно совпадает)
	local ct, tag = aes_gcm(true, keys.key, nonce_from_iv(keys.iv, up.pn), plain, hdr_u)
	if not ct then return nil, "gcm encrypt" end
	local packet = hdr_u .. ct .. tag
	local pn_off = #hdr_u - up.pn_len + 1
	local sample = string.sub(packet, pn_off + 4, pn_off + 19)
	local mask = aes(true, keys.hp, sample)
	if not mask then return nil, "hp aes failed" end
	local b1 = bu8(bitxor(u8(packet, 1), bitand(u8(mask, 1), 0x0F)))
	local pnprot = {}
	for j = 1, up.pn_len do
		pnprot[j] = bu8(bitxor(u8(packet, pn_off + j - 1), u8(mask, j + 1)))
	end
	return b1 .. string.sub(packet, 2, pn_off - 1) .. table.concat(pnprot) .. string.sub(packet, pn_off + up.pn_len)
end

local function crypto_stream(plain)
	local i, pieces, min_off, rest = 1, {}, nil, {}
	while i <= #plain do
		local ft = u8(plain, i)
		if ft == 0 then
			while i <= #plain and u8(plain, i) == 0 do i = i + 1 end
		elseif ft == 1 then
			rest[#rest + 1] = "\1"
			i = i + 1
		elseif ft == 6 then
			local off, n1 = quic_tvb(plain, i + 1)
			if not off then return nil, "bad crypto offset" end
			local len, n2 = quic_tvb(plain, i + 1 + n1)
			if not len then return nil, "bad crypto len" end
			local ds = i + 1 + n1 + n2
			if ds + len - 1 > #plain then return nil, "truncated crypto" end
			pieces[#pieces + 1] = { off = off, data = string.sub(plain, ds, ds + len - 1) }
			if not min_off or off < min_off then min_off = off end
			i = ds + len
		else
			rest[#rest + 1] = string.sub(plain, i)
			break
		end
	end
	if #pieces == 0 then return nil, "no CRYPTO" end
	local max = 0
	for _, p in ipairs(pieces) do
		local e = p.off + #p.data
		if e > max then max = e end
	end
	local buf = {}
	for j = 1, max do buf[j] = "\0" end
	for _, p in ipairs(pieces) do
		for j = 1, #p.data do
			buf[p.off + j] = string.sub(p.data, j, j)
		end
	end
	return table.concat(buf), min_off or 0, table.concat(rest)
end

local function wrap_tls_record(hs)
	return "\22\3\1" .. bu16(#hs) .. hs
end

local function apply_tls_mods(stream, tls_list, payload)
	if not tls_list or tls_list == "" then return stream end
	if u8(stream, 1) ~= 1 then return nil, "CRYPTO is not ClientHello" end
	local hlen = 4 + u24(stream, 2)
	if hlen > #stream then return nil, "truncated ClientHello" end
	local ch, extra = string.sub(stream, 1, hlen), string.sub(stream, hlen + 1)
	local rec = wrap_tls_record(ch)
	local orig
	if payload and #payload > 0 then
		-- dupsid ждёт record layer
		if u8(payload, 1) == 22 then
			orig = payload
		else
			orig = wrap_tls_record(payload)
		end
	end
	local nrec = tls_mod(rec, tls_list, orig)
	if not nrec then return nil, "tls_mod failed" end
	return string.sub(nrec, 6) .. extra
end

function quic_mod(blob, modlist, payload)
	local m, err = parse_mods(modlist)
	if not m then
		DLOG("quic_mod: " .. tostring(err))
		return nil
	end
	if not m.dcid and not m.scid and (not m.tls_list or m.tls_list == "") then
		return blob
	end
	local hdr, err = parse_initial(blob)
	if not hdr then
		DLOG("quic_mod: " .. tostring(err))
		return nil
	end
	local keys, err = initial_keys(hdr.dcid, hdr.ver)
	if not keys then
		DLOG("quic_mod: keys: " .. tostring(err))
		return nil
	end
	local up, err = decrypt_initial(blob, hdr, keys)
	if not up then
		DLOG("quic_mod: decrypt: " .. tostring(err))
		return nil
	end

	local plain = up.plain
	if m.tls_list and m.tls_list ~= "" then
		local stream, coff, rest = crypto_stream(plain)
		if not stream then
			DLOG("quic_mod: " .. tostring(coff))
			return nil
		end
		local nstream, e2 = apply_tls_mods(stream, m.tls_list, payload)
		if not nstream then
			DLOG("quic_mod: " .. tostring(e2))
			return nil
		end
		local crypto_fr = "\6" .. bquic_tvb(coff) .. bquic_tvb(#nstream) .. nstream
		local body = crypto_fr .. rest
		if #body > #plain then
			DLOG("quic_mod: new hello does not fit (need " .. (#body - #plain) .. " more padding bytes)")
			return nil
		end
		plain = body .. string.rep("\0", #plain - #body)
	end

	local dcid, scid = hdr.dcid, hdr.scid
	if m.dcid then dcid = bcryptorandom(#dcid) end
	if m.scid then scid = bcryptorandom(#scid) end

	local out_keys = keys
	if dcid ~= hdr.dcid then
		out_keys = initial_keys(dcid, hdr.ver)
	end
	local initial, e3 = encrypt_initial(hdr, up, out_keys, dcid, scid, plain)
	if not initial then
		DLOG("quic_mod: encrypt: " .. tostring(e3))
		return nil
	end
	return initial .. string.sub(blob, hdr.pkt_end + 1)
end

function quic_mod_shim(desync, blob, modlist, payload)
	local p1, p2 = string.find(modlist, "sni=%%[^,]+")
	if p1 then
		local var = string.sub(modlist, p1 + 5, p2)
		local val = desync[var] or _G[var]
		if not val then error("quic_mod_shim: non-existent var '" .. var .. "'") end
		modlist = string.sub(modlist, 1, p1 + 3) .. tostring(val) .. string.sub(modlist, p2 + 1)
	end
	return quic_mod(blob, modlist, payload)
end

-- fake для QUIC: как fake(), но с quic_mod
-- --lua-desync=quic_fake:blob=quic_google:quic_mod=rndcid,rnd,rndsni:repeats=11
function quic_fake(ctx, desync)
	direction_cutoff_opposite(ctx, desync)
	if desync.dis.udp and direction_check(desync) and payload_check(desync) then
		if replay_first(desync) then
			if not desync.arg.blob then error("quic_fake: 'blob' arg required") end
			if desync.arg.optional and not blob_exist(desync, desync.arg.blob) then
				DLOG("quic_fake: blob missing, skip")
				return
			end
			local fake_payload = blob(desync, desync.arg.blob)
			if desync.arg.quic_mod then
				local pl = quic_mod_shim(desync, fake_payload, desync.arg.quic_mod, desync.decrypt_data)
				if pl then
					fake_payload = pl
				else
					DLOG("quic_fake: quic_mod failed, sending raw blob")
				end
			end
			if b_debug then DLOG("quic_fake: " .. hexdump_dlog(fake_payload)) end
			rawsend_payload_segmented(desync, fake_payload)
		else
			DLOG("quic_fake: not acting on further replay pieces")
		end
	end
end

-- правка ИСХОДЯЩЕГО Initial (ломает хендшейк с сервером — только если это сознательно)
-- --lua-desync=quic_pktmod:quic_mod=rndcid,rnd,sni=www.google.com
function quic_pktmod(ctx, desync)
	if not desync.dis.udp or not direction_check(desync) or not payload_check(desync) then return end
	local modlist = desync.arg.quic_mod or "rndcid,rnd,rndsni"
	local pl = quic_mod_shim(desync, desync.dis.payload, modlist, desync.decrypt_data)
	if not pl then return end
	desync.dis.payload = pl
	return VERDICT_MODIFY
end