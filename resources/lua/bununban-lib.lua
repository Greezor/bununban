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
        if #bag == 0 then
            return nil
        end

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
-- arg : blob=<var> - use blob instead of payload
-- arg : blob_type=<l7payload> - set payload type. default: desync.l7payload
-- arg : tls_mod=<list> - comma separated list of tls mods: rnd,rndsni,sni=<str>,dupsid,padencap. sni=%var is supported
-- arg : ops=<op=val,op=val,...> - operations list. available operations:
--       rnd=<x.y> - randomize bytes from x to y. first byte is 0. u can use markers, for example: sld+1.endsld-1 or endsld.-1
--       rpl=<blob.x> - replace bytes with blob from position x
--       pad=<len> - append padding, if len < 0 then prepend
--       cut=<x.y> - cut out part
-- arg : qty=<number|number-number> - number of unique payloads or range for random number
-- arg : dup=<number|number-number> - number of duplicates of each payload (like repeats)
-- arg : put=<var> - add mangled payloads to desync.<var>[]
-- arg : nosend - do not send mangled payload
function mangle(ctx, desync)
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

                    if not desync.arg.nosend then
                        if b_debug then DLOG("mangle: len=" .. #fake .. " : " .. hexdump_dlog(fake)) end
                        rawsend_payload_segmented(desync, fake)
                    end
                end
            end
		else
			DLOG("mangle: not acting on further replay pieces")
		end
	end
end

-- standard args : direction, payload
-- arg : to=<to> - add payload to _G.<to>[]
-- arg : limit=<number> - max length for _G.<to>[]. default: infinity
-- arg : only_valid_tls - add only valid tls dissects
function wangle(ctx, desync)
    direction_cutoff_opposite(ctx, desync)

    local data = desync.reasm_data or desync.dis.payload

    if #data > 0 and direction_check(desync) and payload_check(desync) then
        if replay_first(desync) then
            if desync.arg.to and (not desync.arg.only_valid_tls or tls_dissect(data)) then
                if not _G[desync.arg.to] then
                    _G[desync.arg.to] = {}
                end

                if b_debug then DLOG("wangle: len=" .. #data .. " : " .. hexdump_dlog(data)) end
                table.insert(_G[desync.arg.to], data)

                if desync.arg.limit then
                    local len = #_G[desync.arg.to]
                    local limit = tonumber(desync.arg.limit)
                    if len > limit then
                        _G[desync.arg.to] = { unpack(_G[desync.arg.to], len - limit + 1, len) }
                    end
                end
            end
        end
    end
end

-- standard args : direction, payload, fooling, ip_id, rawsend, reconstruct. FOOLING AND REPEATS APPLIED ONLY TO FAKES.
-- arg : blob=<blob> - use this data instead of desync.dis.payload
-- arg : fakes=<blob,blob,blobs[]...> - blob or blobs as fakes
-- arg : fakes_type=<l7payload> - default: desync.l7payload
-- arg : fakes_tls_mod=<list> - comma separated list of tls mods: rnd,rndsni,sni=<str>,dupsid,padencap. sni=%var is supported
-- arg : qty=<number|number-number> - number of unique fakes or range for random number. default: 0
-- arg : dup=<number|number-number> - number of duplicates of each payload (like repeats). default: 1
-- arg : pre=<number> - guaranteed number of fakes before orig. default: 0
-- arg : origsplit=<number|posmarker> - spliting position for orig. default: 0
-- arg : fakesplit=<number|posmarker> - spliting position for fake. default: 0
-- arg : seqovl=<number|posmarker> - decrease seq number of the first segment and fill bytes with fake data
-- arg : nodrop - do not drop current dissect
function tangle(ctx, desync)
    direction_cutoff_opposite(ctx, desync)

    local data = blob_or_def(desync, desync.arg.blob) or desync.reasm_data or desync.dis.payload

    if #data > 0 and direction_check(desync) and payload_check(desync) then
        if replay_first(desync) then
            local fakes = {}

            if desync.arg.fakes then
                for var_name in string.gmatch(desync.arg.fakes, "([^,]+)") do
                    local blobs = desync[var_name] or _G[var_name] or {}

                    if type(blobs) ~= "table" then
                        blobs = { blobs }
                    end

                    for i, b in ipairs(blobs) do
                        table.insert(fakes, desync.arg.fakes_tls_mod and tls_mod_shim(desync, b, desync.arg.fakes_tls_mod, b) or b)
                    end
                end
            end

            local get_fake = createShuffledBag(fakes)
            local fakes_type = desync.arg.fakes_type or desync.l7payload

            local origsplit_spos = desync.arg.origsplit or ""
            local fakesplit_spos = desync.arg.fakesplit or ""

            local opts_orig = { rawsend = rawsend_opts_base(desync), reconstruct = {}, ipfrag = {}, ipid = desync.arg, fooling = { tcp_ts_up = desync.arg.tcp_ts_up } }
            local opts_fake = { rawsend = rawsend_opts(desync), reconstruct = reconstruct_opts(desync), ipfrag = {}, ipid = desync.arg, fooling = desync.arg }

            local packets = {}

            local function append_packet(to, packet, is_fake)
                local spos = is_fake and fakesplit_spos or origsplit_spos
                local pos = spos ~= "" and resolve_multi_pos(packet, is_fake and fakes_type or desync.l7payload, spos) or {}

                for i = 0, #pos do
                    local pos_start = pos[i] or 1
                    local pos_end = i >= #pos and #packet or pos[i + 1] - 1
                    local part = string.sub(packet, pos_start, pos_end)
                    local seqovl = 0

                    if i == 0 and desync.arg.seqovl and #fakes > 0 then
                        local seqovl_fake = get_fake()
                        seqovl = resolve_pos(seqovl_fake, fakes_type, desync.arg.seqovl) or tonumber(desync.arg.seqovl) or 0

                        if seqovl > 0 then
                            part = string.sub(seqovl_fake, 1, seqovl) .. part
                        end
                    end
                    
                    table.insert(to, { payload = part, seq = pos_start - 1 - seqovl, opts = is_fake and opts_fake or opts_orig })
                end
            end

            local qty = math.random(parse_range(desync.arg.qty or "0"))
            local dup = math.random(parse_range(desync.arg.dup or "1"))

            if #fakes > 0 then
                for q = 1, qty do
                    local fake = get_fake()
                    
                    for d = 1, dup do
                        append_packet(packets, fake, true)
                    end
                end
            end

            shuffle(packets)

            local div = tonumber(desync.arg.pre or "0")
            local packets1 = { unpack(packets, 1, div) }
            local packets2 = { unpack(packets, div + 1, #packets) }

            for d = 1, dup do
                append_packet(packets2, data, false)
            end

            shuffle(packets2)

            packets = {}
            for _, v in ipairs(packets1) do table.insert(packets, v) end
            for _, v in ipairs(packets2) do table.insert(packets, v) end

            for i, packet in ipairs(packets) do
                if b_debug then DLOG("tangle: len=" .. #packet.payload .. " : " .. hexdump_dlog(packet.payload)) end
                rawsend_payload_segmented(desync, packet.payload, packet.seq, packet.opts)
            end

            replay_drop_set(desync)
            return desync.arg.nodrop and VERDICT_PASS or VERDICT_DROP
        end

        if replay_drop(desync) then
            return desync.arg.nodrop and VERDICT_PASS or VERDICT_DROP
        end
    end
end