function uuid()
    local template ='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', function (c)
        local v = (c == 'x') and math.random(0, 0xf) or math.random(8, 0xb)
        return string.format('%x', v)
    end)
end



function delay(fn, ms)
    local id = uuid()
    _G[id] = function() fn(); _G[id] = nil end
    timer_set(id, id, ms, true)
end



function debounced(fn, ms)
    local id = uuid()

    return function(arg)
        _G[id] = function() fn(arg); _G[id] = nil end
        timer_set(id, id, ms, true)
    end
end



function shuffle(tbl)
    for i = #tbl, 2, -1 do
        local j = math.random(i)
        tbl[i], tbl[j] = tbl[j], tbl[i]
    end

    return tbl
end



function create_shuffled_bag(bag, reset_index)
    local i = 1

    reset_index = reset_index or #bag

    return function()
        if #bag == 0 then
            return nil
        end

        if i == 1 then
            shuffle(bag)
        end

        local item = bag[i]
        i = i + 1

        if i > reset_index or i > #bag then
            i = 1
        end

        return item
    end
end



function memoize(fn, ttl)
    local cache = {}

    local CACHE_STATE_KEY = {}
    local NIL_KEY = {}
    local NAN_KEY = {}

    function get_nested_cache(...)
        local nested = cache

        local n = select("#", ...)
        for i = 1, n do
            local arg = select(i, ...)

            if arg == nil then arg = NIL_KEY end
            if arg ~= arg then arg = NAN_KEY end

            if not nested[arg] then nested[arg] = {} end
            nested = nested[arg]
        end

        return nested
    end

    return function(...)
        local nested_cache = get_nested_cache(...)

        if nested_cache[CACHE_STATE_KEY] == nil then
            nested_cache[CACHE_STATE_KEY] = {
                value = fn(...),
                unmemoize = debounced(function()
                    if nested_cache then
                        nested_cache[CACHE_STATE_KEY] = nil
                    end
                end, ttl or 0)
            }
        end

        if ttl then
            nested_cache[CACHE_STATE_KEY].unmemoize()
        end

        return nested_cache[CACHE_STATE_KEY].value
    end
end



function create_fake_dns(domains, is_tcp, force_mdns)
    if type(domains) == "string" then
        domains = { domains }
    end
    
    local id = "\x00\x00"
    local flags = "\x00\x00"

    if #domains == 1 and not force_mdns then
        id = bcryptorandom(2)
        flags = "\x01\x00"
    end

    local header = id .. flags .. bu16(#domains) .. "\x00\x00\x00\x00\x00\x00"

    local body = ""

    for i, domain in ipairs(domains) do
        for part in string.gmatch(domain, "[^.]+") do
            body = body .. bu8(#part) .. part
        end

        body = body .. "\x00\x00\x01\x00\x01"
    end

    local fake = header .. body

    if is_tcp then
        fake = bu16(#fake) .. fake
    end

    return fake
end



_G.ipmem = (
    function()
        local mem = memoize(function(memkey)
            return {}
        end, 300000)

        return function(ctx, desync)
            if not desync.arg.get then
                error("ipmem: 'get' arg required")
            end

            if not desync.arg.set then
                error("ipmem: 'set' arg required")
            end

            local memkey = (desync.target.ip or desync.target.ip6) .. desync.arg.get
            local memval = mem(memkey)

            local fname = desync.func_instance .. "_ipmem_set"
            if not _G[fname] then
                local err
                _G[fname], err = load(desync.arg.set, fname)
                if not _G[fname] then
                    error(err)
                    return
                end
            end

            if not memval.value then
                _G.desync = desync
                local res, v = pcall(_G[fname])
                _G.desync = nil
                
                if not res then
                    error(v)
                end

                memval.value = v
            end

            desync[desync.arg.get] = memval.value
        end
    end
)()



_G.pick_random_domain = create_shuffled_bag({
    "steampowered.com",
    "epicgames.com",
    "playstation.com",
    "nintendo.com",
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "wikipedia.org",
})