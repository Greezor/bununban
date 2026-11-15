-- Lua 5.1; zapret2 native crypto only.
local sub, byte, char, rep = string.sub, string.byte, string.char, string.rep
local floor, min, max = math.floor, math.min, math.max

local function check(ok, msg) assert(ok, "quic: " .. msg) end

local function uint(s, p, n)
	check(p >= 1 and p + n - 1 <= #s, "truncated integer")
	local v = 0
	for i = p, p + n - 1 do v = v * 256 + byte(s, i) end
	check(v <= 9007199254740991, "integer exceeds Lua 5.1 precision")
	return v
end

local function bin(v, n)
	local s = ""
	for i = 1, n do
		s = char(v % 256) .. s;
		v = floor(v / 256)
	end
	return s
end

local function var(s, p)
	local n = 2 ^ floor(uint(s, p, 1) / 64)
	local v = uint(s, p, 1) % 64
	check(p + n - 1 <= #s, "truncated varint")
	for i = p + 1, p + n - 1 do v = v * 256 + byte(s, i) end
	check(v <= 9007199254740991, "varint exceeds Lua 5.1 precision")
	return v, p + n
end

local function enc(v)
	if v < 64 then return char(v) end
	if v < 16384 then return bin(v + 16384, 2) end
	if v < 1073741824 then return bin(v + 2147483648, 4) end
	return char(192) .. bin(v, 7)
end

local function rawhex(s)
	return (s:gsub("..", function(x) return char(tonumber(x, 16)) end))
end

local salts = {
	rawhex("7fbcdb0e7c66bbe9193a96cd21519ebd7a02644a"),
	rawhex("c3eef712c72ebb5a11a7d2432bb46365bef9f502"),
	rawhex("afbfec289993d24c9e9786f19c6111e04390a899"),
	rawhex("38762cf7f55934b34d179ae6a4c80cadccbb7f0a"),
	rawhex("0dede3def700a6db819381be6e269dcbf9bd2ed9")
}

local oldsalts = {
	[0x51303530] = rawhex("504574efd066fe2f9d945cfcdbd3a7f0d3b56b45"),
	[0x54303530] = rawhex("7ff579e5acd072915580304c43a2367c60488310"),
	[0x54303531] = rawhex("7a4edef4e7ccee5fa4506c19124fc8ccda6e033d")
}

local function v2(v) return v == 0x6b3343cf or v == 0x709a50c4 end

local function label(s, n)
	s = "tls13 " .. s
	return bin(n, 2) .. char(#s) .. s .. "\0"
end

local function expand(k, s, n)
	k = k .. rep("\0", 64 - #k)
	return sub(hash("sha256", bxor(k, rep("\92", 64)) .. hash("sha256", bxor(k, rep("\54", 64)) .. label(s, n) .. "\1")), 1, n)
end

local function keys(h)
	local v, d = h.ver, h.ver % 256
	local salt = oldsalts[v]
	if not salt then
		if v == 1 then
			salt = salts[4]
		elseif v2(v) then
			salt = salts[5]
		elseif v == 0xfaceb001 then
			salt = salts[1]
		elseif v == 0xfaceb002 or v == 0xfaceb00e then
			salt = salts[2]
		elseif floor(v / 256) == 0xff0000 and d >= 11 and d <= 34 then
			salt = salts[d <= 22 and 1 or d <= 28 and 2 or d <= 32 and 3 or 4]
		end
	end
	check(salt, "unsupported QUIC version")
	local secret = hkdf("sha256", salt, h.dcid, label("client in", 32), 32)
	local prefix = v2(v) and "quicv2 " or "quic "
	h.key = expand(secret, prefix .. "key", 16)
	h.iv = expand(secret, prefix .. "iv", 12)
	h.hp = expand(secret, prefix .. "hp", 16)
end

local function nonce(h, pn) return bxor(h.iv, rep("\0", 4) .. bin(pn, 8)) end

local function header(s, p)
	local start = p
	local f = uint(s, p, 1)
	if f < 128 then return nil, #s + 1 end
	local h = {ver = uint(s, p + 1, 4)}
	check(h.ver ~= 0, "version negotiation is not Initial")
	local n = uint(s, p + 5, 1)
	check(n <= 20, "DCID too long")
	h.dcid = sub(s, p + 6, p + 5 + n);
	p = p + 6 + n
	n = uint(s, p, 1);
	check(n <= 20, "SCID too long")
	check(p + n <= #s, "truncated SCID")
	h.scid = sub(s, p + 1, p + n);
	p = p + n + 1
	local typ = floor(f / 16) % 4
	local initial = typ == (v2(h.ver) and 1 or 0)
	if typ == (v2(h.ver) and 0 or 3) then return nil, #s + 1 end
	if initial then
		n, p = var(s, p);
		check(n <= #s - p + 1, "truncated token")
		h.token = sub(s, p, p + n - 1);
		p = p + n
	end
	n, p = var(s, p)
	check(n <= #s - p + 1, "truncated packet")
	if not initial then return nil, p + n end
	check(n >= 20, "Initial too short")
	h.packet = sub(s, start, p + n - 1)
	h.po = p - start + 1
	keys(h)
	return h, p + n
end

local function decrypt(h, expected)
	local s, p = h.packet, h.po
	local mask = aes(true, h.hp, sub(s, p + 4, p + 19))
	check(mask, "header protection failed")
	local f = byte(bxor(sub(s, 1, 1), char(byte(mask) % 16)))
	check(f % 16 < 4, "nonzero reserved bits")
	local n = f % 4 + 1
	local truncated = bxor(sub(s, p, p + n - 1), sub(mask, 2, n + 1))
	local pn, win = uint(truncated, 1, n), 256 ^ n
	local candidate = floor(expected / win) * win + pn
	if candidate + win / 2 <= expected then
		candidate = candidate + win
	elseif candidate > expected + win / 2 and candidate >= win then
		candidate = candidate - win
	end
	local aad = char(f) .. sub(s, 2, p - 1) .. truncated
	local cipher = sub(s, p + n, #s - 16)
	local clean, tag = aes_gcm(false, h.key, nonce(h, candidate), cipher, aad)
	if tag ~= sub(s, -16) and candidate ~= pn then
		candidate = pn
		clean, tag = aes_gcm(false, h.key, nonce(h, candidate), cipher, aad)
	end
	check(clean and tag == sub(s, -16), "invalid Initial GCM tag")
	h.first, h.pnl, h.pn = f, n, candidate
	return clean
end

local function frames(s, pieces)
	local p = 1
	while p <= #s do
		local t;
		t, p = var(s, p)
		if t == 6 then
			local off, n;
			off, p = var(s, p);
			n, p = var(s, p)
			check(n <= #s - p + 1 and off + n <= 16777219, "invalid CRYPTO range")
			if n > 0 then
				pieces[#pieces + 1] = {off, sub(s, p, p + n - 1)}
			end
			p = p + n
		elseif t == 2 or t == 3 then
			local largest, delay, count, first
			largest, p = var(s, p);
			delay, p = var(s, p);
			count, p = var(s, p);
			first, p = var(s, p)
			check(count <= #s - p + 1, "invalid ACK range count")
			for i = 1, count * 2 + (t == 3 and 3 or 0) do
				local v;
				v, p = var(s, p)
			end
		elseif t == 28 then
			local code, ft, n
			code, p = var(s, p);
			ft, p = var(s, p);
			n, p = var(s, p)
			check(n <= #s - p + 1, "truncated CONNECTION_CLOSE");
			p = p + n
		else
			check(t == 0 or t == 1, "unsupported Initial frame " .. t)
		end
	end
end

local function hello(s)
	check(type(s) == "string" and #s >= 4 and byte(s) == 1, "data must be raw ClientHello")
	local n = uint(s, 2, 3) + 4
	check(#s >= n, "incomplete ClientHello")
	return sub(s, 1, n)
end

local function args(d)
	local a = d.arg
	check(a and type(a.blobs) == "string" and a.blobs ~= "" and type(a.data) == "string" and a.data ~= "" and a.blobs ~= a.data, "blobs/data arguments required and must differ")
	return a
end

function quic_unpack(ctx, desync)
	local a = args(desync)
	local blobs = desync[a.blobs]
	check(type(blobs) == "table" and #blobs > 0, "blobs must be a nonempty array")
	local pieces, identity, expected = {}, nil, 0
	for _, s in ipairs(blobs) do
		check(type(s) == "string" and #s > 0, "blob must be a binary string")
		local p = 1
		while p <= #s do
			local h;
			h, p = header(s, p)
			if h then
				local id = bin(h.ver, 4) .. char(#h.dcid) .. h.dcid
				check(not identity or identity == id, "mixed QUIC connections")
				identity = id
				frames(decrypt(h, expected), pieces);
				expected = max(expected, h.pn + 1)
			end
		end
	end
	table.sort(pieces, function(x, y) return x[1] < y[1] end)
	local data = ""
	for _, v in ipairs(pieces) do
		local off, s = v[1], v[2]
		check(off <= #data, "gap in CRYPTO stream")
		local overlap = min(#data - off, #s)
		check(sub(data, off + 1, off + overlap) == sub(s, 1, overlap),
				"conflicting CRYPTO overlap")
		data = data .. sub(s, overlap + 1)
	end
	desync[a.data] = hello(data)
end

local nextpn = {}

function quic_pack(ctx, desync)
	local a = args(desync)
	local data = hello(desync[a.data])
	local size = tonumber(a.max_udp or 1200)
	check(size and size == floor(size) and size > 0 and size <= 65507, "max_udp must be 1..65507")
	local blobs = desync[a.blobs]
	check(blobs == nil or type(blobs) == "table", "blobs must be an array")
	local h, id
	if a.template then
		local s = desync[a.template] or _G[a.template]
		if not s and sub(a.template, 1, 2) == "0x" then
			s = sub(a.template, 3)
			check(#s % 2 == 0 and not s:find("[^%x]"), "invalid hex template");
			s = rawhex(s)
		end
		check(type(s) == "string", "template blob unavailable")
		h = header(s, 1);
		check(h, "template must begin with Initial")
		decrypt(h, 0)
		id = bin(h.ver, 4) .. h.dcid
		h.pn = max(h.pn + 1, nextpn[id] or 0)
	else
		h = {
			ver = 1,
			dcid = bcryptorandom(8),
			scid = bcryptorandom(8),
			token = "",
			first = 195,
			pnl = 4,
			pn = 0
		}
		keys(h)
	end
	local prefix = bin(h.ver, 4) .. char(#h.dcid) .. h.dcid .. char(#h.scid) .. h.scid .. enc(#h.token) .. h.token
	local width = size - #prefix - 3 < 16384 and 2 or 4
	local packets, off = {}, 0
	while off < #data do
		check(h.pn < 4294967296, "packet number exceeds 32-bit Initial range")
		while h.pn >= 256 ^ h.pnl do h.pnl = h.pnl + 1 end
		local pre = char(h.first - h.first % 4 + h.pnl - 1) .. prefix
		local capacity = size - #pre - width - h.pnl - 16
		check(capacity >= 5, "template header exceeds max_udp")
		local n = min(#data - off, capacity - 1 - #enc(off) - 1)
		while 1 + #enc(off) + #enc(n) + n > capacity do n = n - 1 end
		check(n > 0, "no room for CRYPTO data")
		local plain = "\6" .. enc(off) .. enc(n) .. sub(data, off + 1, off + n)
		plain = plain .. rep("\0", capacity - #plain)
		local aad = pre .. bin(h.pnl + #plain + 16 + (width == 2 and 16384 or 2147483648), width) .. bin(h.pn, h.pnl)
		local cipher, tag = aes_gcm(true, h.key, nonce(h, h.pn), plain, aad)
		check(cipher and tag, "encryption failed")
		local s = aad .. cipher .. tag
		local p = #aad - h.pnl + 1
		local mask = aes(true, h.hp, sub(s, p + 4, p + 19))
		check(mask, "header protection failed")
		s = bxor(sub(s, 1, 1), char(byte(mask) % 16)) .. sub(s, 2, p - 1) .. bxor(sub(s, p, p + h.pnl - 1), sub(mask, 2, h.pnl + 1)) .. sub(s, p + h.pnl)
		check(#s == size, "internal packet size mismatch")
		packets[#packets + 1] = s
		off = off + n;
		h.pn = h.pn + 1
	end
	if id then nextpn[id] = h.pn end
	if not blobs then
		blobs = {};
		desync[a.blobs] = blobs
	end
	for _, s in ipairs(packets) do blobs[#blobs + 1] = s end
end
