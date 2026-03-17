function parse_range(str)
    local min, max = str:match("^([+-]?%d+)%-([+-]?%d+)$")

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

    for i = start, stop, (step or 1) do
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

-- arg : tcp_ts_rnd - set random tcp_ts. default: -1000--600000
-- arg : tcp_seq_rnd - set random tcp_seq. default: 10000-10000000
-- arg : tcp_ack_rnd - set random tcp_ack. default: 10000-10000000
function bununban_fooling(desync)
    if desync.arg.tcp_ts_rnd then
        if desync.arg.tcp_ts_rnd == "" then desync.arg.tcp_ts_rnd = "-1000--600000" end
        desync.arg.tcp_ts = tostring(math.random(parse_range(desync.arg.tcp_ts_rnd)))
    end

    if desync.arg.tcp_seq_rnd then
        if desync.arg.tcp_seq_rnd == "" then desync.arg.tcp_seq_rnd = "10000-10000000" end
        desync.arg.tcp_seq = tostring(math.random(parse_range(desync.arg.tcp_seq_rnd)))
    end

    if desync.arg.tcp_ack_rnd then
        if desync.arg.tcp_ack_rnd == "" then desync.arg.tcp_ack_rnd = "10000-10000000" end
        desync.arg.tcp_ack = tostring(math.random(parse_range(desync.arg.tcp_ack_rnd)))
    end
end

-- standard args : direction, payload, fooling, ip_id, rawsend, reconstruct, ipfrag
-- arg : blob=<var> - use blob instead of payload
-- arg : blob_type=<l7payload> - set payload type. default: desync.l7payload
-- arg : tls_mod=<list> - comma separated list of tls mods: rnd,rndsni,sni=<str>,dupsid,padencap. sni=%var is supported
-- arg : ops=<op=val,op=val,...> - operations list. available operations:
--       rnd=<x>.<y> - randomize bytes from x to y. first byte is 0. u can use markers, for example: sld+1.endsld-1 or endsld.-1
--       rpl=<blob>.<x> - replace bytes with blob from position x
--       pad=<len> - append padding, if len < 0 then prepend
--       cut=<x>.<y> - cut out part
-- arg : qty=<number|number-number> - number of unique payloads or range for random number
-- arg : dup=<number|number-number> - number of duplicates of each payload (like repeats)
-- arg : put=<var> - add mangled payloads to desync.<var>[]
-- arg : nosend - do not send mangled payload
function mangled(ctx, desync)
    local function get_range(range, payload, payload_type)
        local from, to = string.match(range, "^([+-]?.-)%.([+-]?.-)$")

        if not from or from == "" then from = "0" end
        if not to or to == "" then to = from end

        local range = resolve_range(payload, payload_type, from .. ',' .. to)

        if not range then
            return 0, 0
        end

        return unpack(range)
    end

    direction_cutoff_opposite(ctx, desync)

	if direction_check(desync) and payload_check(desync) then
		if replay_first(desync) then
            local orig = blob_or_def(desync, desync.arg.blob) or desync.reasm_data or desync.dis.payload
            local qty = math.random(parse_range(desync.arg.qty or "1"))

            for q = 1, qty do
                local payload = orig
                local fake = payload
                local payload_type = desync.arg.blob_type or desync.l7payload

                if desync.arg.tls_mod then
                    fake = tls_mod_shim(desync, fake, desync.arg.tls_mod, orig)
                end

                if desync.arg.ops then
                    for op, val in string.gmatch(desync.arg.ops, "([^=,]+)=([^=,]+)") do
                        if op == "rnd" then

                            local from, to = get_range(val, payload, payload_type)

                            local replacement = ""
                            for i = from, to do
                                replacement = replacement .. string.char(math.random(0, 255))
                            end

                            fake = string.sub(fake, 1, from - 1) .. replacement .. string.sub(fake, to + 1)

                        elseif op == "rpl" then

                            local replacement, pos = string.match(val, "^(0x.-)%.([+-]?.-)$")
                            
                            replacement = blob(desync, replacement)
                            pos = resolve_pos(payload, payload_type, pos)

                            if pos then
                                fake = string.sub(fake, 1, pos - 1) .. replacement .. string.sub(fake, pos + #replacement)
                            end

                        elseif op == "pad" then

                            local len = tonumber(val)
                            
                            local padding = ""
                            for i = 1, math.abs(len) do
                                padding = padding .. string.char(0)
                            end

                            if len < 0 then
                                fake = padding .. fake
                            else
                                fake = fake .. padding
                            end

                            payload = fake
                            payload_type = "unknown"

                        elseif op == "cut" then

                            local from, to = get_range(val, payload, payload_type)

                            fake = string.sub(fake, 1, from - 1) .. string.sub(fake, to + 1)

                            payload = fake
                            payload_type = "unknown"

                        end
                    end
                end

                local dup = math.random(parse_range(desync.arg.dup or "1"))
                for d = 1, dup do
                    if desync.arg.put then
                        if not desync[desync.arg.put] then
                            desync[desync.arg.put] = {}
                        end

                        table.insert(desync[desync.arg.put], fake)
                    end

                    bununban_fooling(desync)

                    if not desync.arg.nosend then
                        if b_debug then DLOG("mangled2: len=" .. #fake .. " : " .. hexdump_dlog(fake)) end
                        rawsend_payload_segmented(desync, fake)
                    end
                end
            end
		else
			DLOG("mangled2: not acting on further replay pieces")
		end
	end
end

function rnd_fake(desync, orig)
    local bytes = {}

    for i = 1, #orig do
        table.insert(bytes, math.random(0, 255))
    end

    return string.char(unpack(bytes))
end

function shuffled_fake(desync, orig)
    local bytes = { string.byte(orig, 1, #orig) }

    shuffle(bytes)

    return string.char(unpack(bytes))
end

function mangle_tls(desync, tls)
    local dis = tls_dissect(tls)
    if not dis then return rnd_fake(desync, tls) end

    local sg_index = array_field_search(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, "type", TLS_EXT_SUPPORTED_GROUPS)
    local sa_index = array_field_search(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, "type", TLS_EXT_SIGNATURE_ALGORITHMS)
    local sni_index = array_field_search(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, "type", TLS_EXT_SERVER_NAME)

    shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.cipher_suites)
    table.remove(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.cipher_suites, 1)

    if sg_index then
        shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[sg_index].dis.list)
        table.remove(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[sg_index].dis.list, 1)
    end

    if sa_index then
        shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[sa_index].dis.list)
        table.remove(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[sa_index].dis.list, 1)
    end

    local sni_ext = deepcopy(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext[sni_index])
    table.remove(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, sni_index)
    shuffle(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext)
    table.remove(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, 1)
    table.insert(dis.handshake[TLS_HANDSHAKE_TYPE_CLIENT].dis.ext, 1, sni_ext)

    return tls_reconstruct(dis)
end

-- standard args : direction, payload, fooling, ip_id, rawsend, reconstruct. FOOLING AND REPEATS APPLIED ONLY TO FAKES.
-- arg : scope=<var> - current instance scope. required
-- arg : blob=<blob> - use this data instead of desync.dis.payload
-- arg : fake=<blob> - use this data instead of desync.dis.payload
-- arg : fake_type=<l7payload> - default: desync.l7payload
-- arg : fake_tls_mod=<list> - comma separated list of tls mods: rnd,rndsni,sni=<str>,dupsid,padencap. sni=%var is supported
-- arg : fake_mod=<func_name> - function to modify fake. default: return fake
-- arg : qty=<number|number-number> - number of unique fakes or range for random number. default: 0
-- arg : dup=<number|number-number> - number of duplicates of each payload (like repeats). default: 1
-- arg : pre=<number> - guaranteed number of fakes before orig. default: 0
-- arg : seqovl=<number|number-number> - decrease seq number of the first segment and fill bytes with fake data. if range - random number. default: 0
-- arg : seqovl_step=<number> - if seqovl is a range, use that as step. default: 1
-- arg : origsplit=<number|posmarker> - first spliting position for orig. default: -1
-- arg : fakesplit=<number|posmarker> - first spliting position for fake. default: -1
-- arg : nodrop - do not drop current dissect
function tangled(ctx, desync)
    if not desync.dis.tcp then
		instance_cutoff_shim(ctx, desync)
		return
	end

    direction_cutoff_opposite(ctx, desync)

    local data = blob_or_def(desync, desync.arg.blob) or desync.reasm_data or desync.dis.payload
    local fakedata = blob_or_def(desync, desync.arg.fake) or data

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
                local from, to = parse_range(desync.arg.seqovl or "0")
                scope.seqovl = createShuffledBag(arange(from, to, tonumber(desync.arg.seqovl_step or "1")))
            end

            local function create_fake()
                local fake = fakedata

                if desync.arg.fake_tls_mod and tls_dissect(fake) then
                    fake = tls_mod_shim(desync, fake, desync.arg.fake_tls_mod, fake)
                end

                if desync.arg.fake_mod then
                    local func = _G[desync.arg.fake_mod]
                    fake = func(desync, fake)
                end

                return fake
            end

            local packets = {}

            local origsplit_spos = desync.arg.origsplit or "-1"
            local fakesplit_spos = desync.arg.fakesplit or "-1"

            local function append_packet(to, packet, is_fake)
                local spos = is_fake and fakesplit_spos or origsplit_spos
                local pos = resolve_pos(packet, is_fake and desync.arg.fake_type or desync.l7payload, spos) or resolve_pos(data, desync.l7payload, spos) or #packet

                for i = 0, math.ceil(#packet / pos) - 1 do
                    local pos_start = i * pos + 1
                    local pos_end = pos_start + pos - 1
                    if pos_end > #packet then pos_end = #packet end
                    local part = string.sub(packet, pos_start, pos_end)
                    local seqovl = 0

                    if i == 0 then
                        local seqovl_fake = create_fake()
                        seqovl = scope.seqovl()
                        part = pattern(seqovl_fake, 1, seqovl) .. part
                    end

                    table.insert(to, { payload = part, seq = pos_start - 1 - seqovl, is_fake = is_fake })
                end
            end

            for q = 1, scope.qty() do
                local fake = create_fake()
                
                for d = 1, scope.dup() do
                    append_packet(packets, fake, true)
                end
            end

            shuffle(packets)

            local div = tonumber(desync.arg.pre or "0")
            local packets1 = { unpack(packets, 1, div) }
            local packets2 = { unpack(packets, div + 1, #packets) }

            for d = 1, scope.dup() do
                append_packet(packets2, data, false)
            end

            shuffle(packets2)

            packets = {}
            for _, v in ipairs(packets1) do table.insert(packets, v) end
            for _, v in ipairs(packets2) do table.insert(packets, v) end

            local opts_orig = { rawsend = rawsend_opts_base(desync), reconstruct = {}, ipfrag = {}, ipid = desync.arg, fooling = { tcp_ts_up = desync.arg.tcp_ts_up } }
            local opts_fake = { rawsend = rawsend_opts(desync), reconstruct = reconstruct_opts(desync), ipfrag = {}, ipid = desync.arg, fooling = desync.arg }

            for i, packet in ipairs(packets) do
                bununban_fooling(desync)

                if b_debug then DLOG("tangled: len=" .. #packet.payload .. " : " .. hexdump_dlog(packet.payload)) end
                rawsend_payload_segmented(desync, packet.payload, packet.seq, packet.is_fake and opts_fake or opts_orig)
            end

            replay_drop_set(desync)
            return desync.arg.nodrop and VERDICT_PASS or VERDICT_DROP
        end

        if replay_drop(desync) then
            return desync.arg.nodrop and VERDICT_PASS or VERDICT_DROP
        end
    end
end