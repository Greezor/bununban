function parse_range(str)
    local min, max = str:match("^(%d+)%-(%d+)$")

    if min and max then
        min = tonumber(min)
        max = tonumber(max)
    else
        min = tonumber(str)
        max = tonumber(str)
    end

    return min, max
end

function shuffle(tbl)
    for i = #tbl, 2, -1 do
        local j = math.random(i)
        tbl[i], tbl[j] = tbl[j], tbl[i]
    end
end

function arange(start, stop, step)
    local a = {}

    for i = start, stop, step or 1 do
        table.insert(a, i)
    end
    
    return a
end

function createShuffledBag(bag, resetIndex)
    local i = 1

    resetIndex = resetIndex or #bag

    return function()
        if i == 1 then
            shuffle(bag)
        end

        local item = bag[i]
        i = i + 1

        if i > resetIndex or i > #bag then
            i = 1
        end

        return item
    end
end

-- standard args : direction, payload, fooling, ip_id, rawsend, reconstruct, ipfrag
-- arg : rnd=<number-number,number-number,...> - segments to randomize
-- arg : qty=<number|number-number> - number of unique payloads or range for random number
-- arg : dup=<number|number-number> - number of duplicates of each payload (like repeats)
-- arg : tls_mod=<list> - comma separated list of tls mods: rnd,rndsni,sni=<str>,dupsid,padencap. sni=%var is supported
-- arg : starts_with=<hex> - replace beginning of packet
-- arg : put=<var> - add mangled payloads to desync.<var>[]
-- arg : blob=<var> - use blob instead of payload
-- arg : nosend - do not send mangled payload
function mangled(ctx, desync)
    local quic_markers = {}

    local function read_quic_varint(buf, pos)
        local first = buf:byte(pos)
        local prefix = math.floor(first / 64)
        local length = 2 ^ prefix
        local value = first % 64

        for i = 2, length do
            value = value * 256 + buf:byte(pos + i - 1)
        end

        return value, length
    end

    local function parse_quic_initial(payload)    
        local pos = 1

        quic_markers.header = pos
        pos = pos + 1

        quic_markers.version_start = pos
        quic_markers.version_end = pos + 3
        pos = pos + 4

        local dcidlen = payload:byte(pos)

        quic_markers.dcid_len = pos
        pos = pos + 1

        quic_markers.dcid_start = pos
        quic_markers.dcid_end = pos + dcidlen - 1
        pos = pos + dcidlen

        local scidlen = payload:byte(pos)

        quic_markers.scid_len = pos
        pos = pos + 1

        quic_markers.scid_start = pos
        quic_markers.scid_end = pos + scidlen - 1
        pos = pos + scidlen

        local tokenlen_value, tokenlen_len = read_quic_varint(payload, pos)

        quic_markers.token_len_start = pos
        quic_markers.token_len_end = pos + tokenlen_len - 1
        pos = pos + tokenlen_len

        if tokenlen_value > 0 then
            quic_markers.token_start = pos
            quic_markers.token_end = pos + tokenlen_value - 1
            pos = pos + tokenlen_value
        else
            quic_markers.token_start = pos
            quic_markers.token_end = pos - 1
        end

        local payloadlen_value, payloadlen_len = read_quic_varint(payload, pos)
        
        quic_markers.payload_len_start = pos
        quic_markers.payload_len_end = pos + payloadlen_len - 1
        pos = pos + payloadlen_len

        local payload_start = pos
        local payload_end = math.min(#payload, pos + payloadlen_value - 1)

        quic_markers.payload_start = payload_start
        quic_markers.payload_end = payload_end
    end

    local function parse_segment(segment, bytes)
        if segment == "version" then
            return quic_markers.version_start, quic_markers.version_end
        end

        if segment == "dcid" then
            return quic_markers.dcid_start, quic_markers.dcid_end
        end

        if segment == "scid" then
            return quic_markers.scid_start, quic_markers.scid_end
        end

        if segment == "token" then
            return quic_markers.token_start, quic_markers.token_end
        end

        if segment == "payload" then
            return quic_markers.payload_start, quic_markers.payload_end
        end

        local from, to = string.match(segment, "^([+-]?%d*)%-([+-]?%d*)$")

        if not from or from == "" then from = "0" end
        if not to or to == "" then to = "0" end

        from = tonumber(from)
        to = tonumber(to)

        if from < 0 then
            from = #bytes + from + 1
            if from < 0 then from = 0 end
        end

        if to < 0 then
            to = #bytes + to + 1
            if to < 0 then to = 0 end
        end

        return from, to
    end

    local function randomize_bytes(bytes, from, to)
        for i = 0, ( to - from ) do
            local index = from + i
            
            if bytes[index] then
                bytes[index] = math.random(0, 255)
            end
        end
    end

    direction_cutoff_opposite(ctx, desync)

	if direction_check(desync) and payload_check(desync) then
		if replay_first(desync) then
            local payload = blob_or_def(desync, desync.arg.blob) or desync.reasm_data or desync.dis.payload
            local qty = math.random(parse_range(desync.arg.qty or "1"))

            if desync.l7payload == "quic_initial" then
                parse_quic_initial(payload)
            end

            for i = 1, qty do
                local fake = payload

                if desync.l7payload == "tls_client_hello" and desync.arg.tls_mod then
                    fake = tls_mod_shim(desync, fake, desync.arg.tls_mod, fake)
                end

                local fakebytes = { string.byte(fake, 1, #fake) }

                if desync.arg.rnd then
                    for segment in string.gmatch(desync.arg.rnd, "([^,]+)") do
                        randomize_bytes(fakebytes, parse_segment(segment, fakebytes))
                    end
                end

                if desync.arg.starts_with then
                    local prefix = parse_hex(string.sub(desync.arg.starts_with, 3))
                    local bytes = { string.byte(prefix, 1, #prefix) }

                    for i = 1, #bytes do
                        fakebytes[i] = bytes[i]
                    end
                end

                local result = string.char(unpack(fakebytes))

                local dup = math.random(parse_range(desync.arg.dup or "1"))
                for j = 1, dup do
                    if desync.arg.put then
                        if not desync[desync.arg.put] then
                            desync[desync.arg.put] = {}
                        end

                        table.insert(desync[desync.arg.put], result)
                    end

                    if not desync.arg.nosend then
                        if b_debug then DLOG("mangled: len=" .. #result .. " : " .. hexdump_dlog(result)) end
                        rawsend_payload_segmented(desync, result)
                    end
                end
            end
		else
			DLOG("mangled: not acting on further replay pieces")
		end
	end
end

-- standard args : direction, payload, fooling, ip_id, rawsend, reconstruct. FOOLING AND REPEATS APPLIED ONLY TO FAKES.
-- arg : scope=<var> - current instance scope. required
-- arg : blob=<blob> - use this data instead of reasm_data
-- arg : qty=<number|number-number> - number of unique fakes or range for random number. default: 0
-- arg : dup=<number|number-number> - number of duplicates of each payload (like repeats). default: 1
-- arg : pre=<number> - guaranteed number of fakes before orig. default: 0
-- arg : seqovl=<number|number-number> - decrease seq number of the first segment and fill bytes with fake data. if range - random number. default: 0
-- arg : seqovl_step=<number> - if seqovl is a range, use that as step. default: 1
-- arg : origsplit=<number|posmarker> - first spliting position for orig. default: midsld
-- arg : fakesplit=<number|posmarker> - first spliting position for fake. default: midsld
-- arg : fake_tls_mod=<list> - comma separated list of tls mods: rnd,rndsni,sni=<str>,dupsid,padencap. sni=%var is supported. default: rnd,dupsid
-- arg : nodrop - do not drop current dissect
function tangled(ctx, desync)
    if not desync.dis.tcp then
		instance_cutoff_shim(ctx, desync)
		return
	end

    direction_cutoff_opposite(ctx, desync)

    local data = blob_or_def(desync, desync.arg.blob) or desync.reasm_data or desync.dis.payload

    if #data > 0 and direction_check(desync) and payload_check(desync) then
        if replay_first(desync) then
            if not desync.arg.scope then error("tangled: 'scope' arg required") end

            if not _G._tangled_scopes then _G._tangled_scopes = {} end
            if not _G._tangled_scopes[desync.arg.scope] then _G._tangled_scopes[desync.arg.scope] = {} end

            local scope = _G._tangled_scopes[desync.arg.scope]

            if not scope.qty then
                scope.qty = createShuffledBag(arange(parse_range(desync.arg.qty or "0")))
            end

            if not scope.dup then
                scope.dup = createShuffledBag(arange(parse_range(desync.arg.dup or "1")))
            end

            if not scope.seqovl then
                scope.seqovl = createShuffledBag(arange(parse_range(desync.arg.seqovl or "0"), tonumber(desync.arg.seqovl_step or "1")))
            end

            local packets = {}

            local fakedis = tls_dissect(data)
            if not fakedis then return VERDICT_PASS end

            local fakedis_sg_index = array_field_search(fakedis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, "type", TLS_EXT_SUPPORTED_GROUPS)
            local fakedis_sa_index = array_field_search(fakedis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, "type", TLS_EXT_SIGNATURE_ALGORITHMS)
            local fakedis_sni_index = array_field_search(fakedis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, "type", TLS_EXT_SERVER_NAME)

            local function create_fake()
                local dis = deepcopy(fakedis)

                shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.cipher_suites)

                if fakedis_sg_index then
                    shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[fakedis_sg_index].dis.list)
                end

                if fakedis_sa_index then
                    shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[fakedis_sa_index].dis.list)
                end

                local sni_ext = deepcopy(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[fakedis_sni_index])
                table.remove(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, fakedis_sni_index)
                shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext)
                table.insert(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, 1, sni_ext)

                local fake = tls_reconstruct(dis)

                return tls_mod_shim(desync, fake, desync.arg.fake_tls_mod or "rnd,dupsid", fake)
            end

            local origsplit_spos = desync.arg.origsplit or "midsld"
            local fakesplit_spos = desync.arg.fakesplit or "midsld"
            local current_seqovl = scope.seqovl()

            local function append_packet(to, payload, is_fake)
                local pos = resolve_pos(payload, desync.l7payload, is_fake and fakesplit_spos or origsplit_spos)

                for i = 0, math.ceil(#payload / pos) - 1 do
                    local pos_start = i * pos + 1
                    local pos_end = pos_start + pos - 1
                    if pos_end > #payload then pos_end = #payload end
                    local part = string.sub(payload, pos_start, pos_end)
                    local seqovl = 0

                    if i == 0 then
                        local seqovl_fake = create_fake()
                        seqovl = current_seqovl
                        part = pattern(seqovl_fake, 1, seqovl) .. part
                    end

                    table.insert(to, { payload = part, seq = pos_start - 1 - seqovl, is_fake = is_fake })
                end
            end

            for q = 1, scope.qty() do
                local fake = create_fake()
                
                for q = 1, scope.dup() do
                    append_packet(packets, fake, true)
                end
            end

            shuffle(packets)

            local div = tonumber(desync.arg.pre or "0")
            local packets1 = { unpack(packets, 1, div) }
            local packets2 = { unpack(packets, div + 1, #packets) }

            for q = 1, scope.dup() do
                append_packet(packets2, data, false)
            end

            shuffle(packets2)

            packets = { unpack(packets1), unpack(packets2) }

            local opts_orig = { rawsend = rawsend_opts_base(desync), reconstruct = {}, ipfrag = {}, ipid = desync.arg, fooling = { tcp_ts_up = desync.arg.tcp_ts_up } }
            local opts_fake = { rawsend = rawsend_opts(desync), reconstruct = reconstruct_opts(desync), ipfrag = {}, ipid = desync.arg, fooling = desync.arg }

            for i, packet in ipairs(packets) do
                if packet then
                    if b_debug then DLOG("tangled: len=" .. #packet.payload .. " : " .. hexdump_dlog(packet.payload)) end
                    rawsend_payload_segmented(desync, packet.payload, packet.seq, packet.is_fake and opts_fake or opts_orig)
                end
            end

            replay_drop_set(desync)
            return desync.arg.nodrop and VERDICT_PASS or VERDICT_DROP
        end
    end

    if replay_drop(desync) then
        return desync.arg.nodrop and VERDICT_PASS or VERDICT_DROP
    end
end