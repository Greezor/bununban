function uuid()
    local template ='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', function (c)
        local v = (c == 'x') and math.random(0, 0xf) or math.random(8, 0xb)
        return string.format('%x', v)
    end)
end



function execf(fname, desync)
    _G.desync = desync
    local ok, ret = pcall(_G[fname])
    _G.desync = nil

    if not ok then
        error(ret)
    end

    return ret
end



function arange(start, stop, step)
    local a = {}

    for i = start, stop, (step or 1) do
        table.insert(a, i)
    end

    return a
end



function array(...)
    return {...}
end



function array_mixed_search(a, f, v)
    if f == "" then
        return array_search(a, v)
    end

    return array_field_search(a, f, v)
end



function get_by_path(target, path)
    local value = target
    local parent = nil
    local key = nil

    for k in string.gmatch(path, "[^.]+") do
        if value == nil then
            return nil, nil, nil
        end

        parent = value
        key = k

        local search_key, search_val = string.match(key, "%[(.-)=(.-)%]")
        if search_key and search_val then
            if search_val == string.gsub(search_val, "%D", "") then
                key = array_mixed_search(value, search_key, tonumber(search_val)) or array_mixed_search(value, search_key, search_val)
            elseif search_val == "nil" then
                key = array_mixed_search(value, search_key, nil) or array_mixed_search(value, search_key, search_val)
            else
                key = array_mixed_search(value, search_key, search_val)
            end
        else
            local numkey = string.match(key, "%[(%-?%d+)%]")
            if numkey or key == "[]" then
                numkey = tonumber(numkey or 0)

                if numkey < 1 then
                    numkey = #value + numkey + 1
                end

                key = numkey
            else
                local varkey = string.match(key, "%[(%w+)%]")
                if varkey then
                    key = desync[varkey] or _G[varkey]
                end
            end
        end

        value = value[key]
    end

    return value, parent, key
end



function delayed(fn, ms, data)
    local id = uuid()

    local function del()
        _G[id] = nil
    end

    _G[id] = function(name, data)
        fn(data)
        del()
    end

    timer_set(id, id, ms, true, data)

    return function()
        timer_del(id)
        del()
    end
end



function debounced(fn, ms)
    local id = uuid()

    _G[id] = function(name, data)
        fn(data)
    end

    return function(arg)
        timer_set(id, id, ms, true, arg)
    end
end



function shuffle(tbl)
    for i = #tbl, 2, -1 do
        local j = math.random(i)
        tbl[i], tbl[j] = tbl[j], tbl[i]
    end

    return tbl
end



function create_shuffled_bag(arr, reset_index)
    local i = 0
    reset_index = reset_index or #arr

    return function()
        if #arr == 0 then
            return nil
        end

        i = i + 1

        if i > reset_index then
            i = 1
        end

        if i == 1 then
            shuffle(arr)
        end

        return arr[i]
    end
end



function create_circular_iterator(arr)
    local i = 0

    return function(current)
        if #arr == 0 then
            return nil
        end

        if current then
            local key = array_search(arr, current)
            if key then i = key end
        end

        i = i + 1

        if i > #arr then
            i = 1
        end

        return arr[i]
    end
end



rndword = create_shuffled_bag({
    "amber", "aqua", "azure", "beige", "black", "blue", "bronze", "brown", "cobalt", 
    "copper", "coral", "crimson", "cyan", "emerald", "gold", "gray", "green", "indigo", 
    "ivory", "jade", "magenta", "maroon", "mustard", "neon", "olive", "orange", "peach", 
    "pink", "platinum", "purple", "red", "ruby", "rust", "sapphire", "silver", "teal", 
    "violet", "white", "yellow",
    
    "alpaca", "ant", "ape", "badger", "bat", "bear", "bee", "bird", "bison", "bug", 
    "camel", "cat", "cobra", "crab", "crane", "crow", "deer", "dingo", "dog", "dolphin", 
    "dove", "dragon", "duck", "eagle", "elk", "falcon", "fish", "fly", "fox", "frog", 
    "gecko", "goat", "goose", "gorilla", "gull", "hawk", "horse", "hound", "husky", 
    "iguana", "impala", "jaguar", "koala", "kraken", "lemur", "leopard", "lion", "lizard", 
    "llama", "lynx", "mantis", "monkey", "moose", "mouse", "mule", "newt", "orca", 
    "ostrich", "otter", "owl", "panda", "panther", "parrot", "pelican", "penguin", "pig", 
    "pigeon", "pony", "pug", "puma", "rabbit", "rat", "raven", "rhino", "robin", "salmon", 
    "seal", "shark", "sheep", "skunk", "snail", "snake", "spider", "squid", "swan", 
    "tiger", "toad", "turtle", "viper", "wasp", "whale", "wolf", "wombat", "worm", "yak", 
    "zebra",
    
    "abyss", "air", "ash", "asteroid", "aura", "aurora", "autumn", "canyon", "cave", 
    "cliff", "comet", "cosmic", "cosmos", "crater", "creek", "dawn", "day", "desert", 
    "dew", "dust", "earth", "eclipse", "ember", "fire", "flame", "flora", "forest", 
    "frost", "galaxy", "glacier", "globe", "horizon", "ice", "island", "jungle", "lake", 
    "lava", "leaf", "lunar", "magma", "marsh", "meteor", "mist", "moon", "moss", 
    "mountain", "nebula", "night", "nova", "ocean", "orbit", "peak", "pebble", "planet", 
    "plasma", "pond", "pulsar", "rain", "reef", "river", "rock", "root", "sand", "sea", 
    "shadow", "sky", "snow", "solar", "spark", "spring", "star", "stone", "storm", 
    "stream", "summer", "sun", "surf", "swamp", "terra", "thunder", "tide", "timber", 
    "tree", "tundra", "twilight", "valley", "vapor", "vortex", "water", "wave", "wind", 
    "winter", "wood",
    
    "alert", "alive", "atomic", "awake", "basic", "better", "big", "bitter", "blind", 
    "bold", "brave", "brief", "bright", "broad", "broken", "calm", "careful", "cheap", 
    "chill", "clean", "clear", "clever", "cold", "cool", "crazy", "crisp", "cruel", 
    "dark", "dead", "deep", "direct", "dirty", "dry", "dull", "dusty", "early", "easy", 
    "empty", "epic", "exact", "extra", "fair", "false", "fast", "fine", "firm", "flat", 
    "free", "fresh", "full", "fun", "funny", "gentle", "glad", "good", "grand", "great", 
    "hard", "happy", "heavy", "hidden", "high", "holy", "hot", "huge", "hyper", "icy", 
    "ideal", "inner", "just", "keen", "kind", "large", "late", "lazy", "left", "light", 
    "little", "live", "local", "long", "loose", "loud", "lucky", "mad", "magic", "main", 
    "major", "mega", "minor", "neat", "new", "nice", "noble", "odd", "old", "open", 
    "outer", "pale", "past", "perfect", "plain", "poor", "prime", "proud", "pure", 
    "quick", "quiet", "rare", "raw", "real", "rich", "right", "rough", "round", "royal", 
    "sad", "safe", "salty", "same", "secret", "sharp", "short", "shy", "sick", "silent", 
    "silly", "slick", "slow", "small", "smart", "smooth", "soft", "solid", "sour", 
    "spare", "spicy", "stark", "stern", "stiff", "still", "strict", "strong", "sweet", 
    "swift", "tall", "tame", "tart", "thick", "thin", "tidy", "tiny", "tough", "true", 
    "twin", "ultra", "unique", "urban", "valid", "vast", "warm", "weak", "wet", "wild", 
    "wise", "wrong", "young", "zero",

    "algorithm", "apex", "armor", "avatar", "axis", "beacon", "beta", "block", "bot", 
    "byte", "cache", "cipher", "circuit", "clone", "cloud", "code", "core", "crypto", 
    "cyber", "data", "delta", "echo", "edge", "enigma", "epoch", "ether", "flux", 
    "force", "fractal", "gear", "grid", "hash", "helix", "host", "hub", "icon", "index", 
    "kilo", "laser", "logic", "macro", "matrix", "mesh", "micro", "nano", "nexus", 
    "node", "omega", "optic", "path", "ping", "pixel", "port", "proxy", "pulse", 
    "quantum", "query", "radar", "relay", "retro", "route", "script", "server", "signal", 
    "sonic", "source", "spark", "sphere", "sync", "syntax", "system", "tech", "token", 
    "trace", "track", "vector", "vertex", "virus", "void", "web", "wire", "zone"
})

function genphrase(count, separator)
    count = count or 2
    separator = separator or "-"

    if count <= 0 then return "" end

    local words = {}

    for i = 1, count do
        words[i] = rndword()
    end

    return table.concat(words, separator)
end



rndhost = create_shuffled_bag({
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "microsoft.com",
    "windows.com",
    "xbox.com",
    "playstation.com",
    "steampowered.com",
    "epicgames.com",
    "nintendo.com",
    "twitch.tv",
    "ttvnw.net",
    "github.com",
    "gitlab.com",
    "npmjs.com",
    "docker.com",
    "vercel.app"
})



local CACHE_STATE_KEY = {}
local NIL_KEY = {}
local NAN_KEY = {}

local function pack(...)
    return { n = select("#", ...), ... }
end

local function get_nested_cache(cache, ...)
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

function memoize(fn, ttl, touch)
    local cache = {}

    local memfn = function(...)
        local nested_cache = get_nested_cache(cache, ...)
        local state = nested_cache[CACHE_STATE_KEY]

        if state == nil then
            local values = pack(fn(...))

            state = {
                values = values,
                unmemoize = debounced(function()
                    nested_cache[CACHE_STATE_KEY] = nil
                end, ttl or 0)
            }

            nested_cache[CACHE_STATE_KEY] = state

            if ttl then
                state.unmemoize()
            end
        elseif touch then
            state.unmemoize()
        end

        return unpack(state.values, 1, state.values.n)
    end

    local set_ttl = function(newttl)
        ttl = newttl
    end

    local set_touch = function(newtouch)
        touch = newtouch
    end

    return memfn, set_ttl, set_touch
end 



function create_fake_dns(domains, is_tcp, id, flags)
    if type(domains) == "string" then
        domains = { domains }
    end
    
    id = id or "\x00\x00"
    flags = flags or "\x01\x00"

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



function create_sni_ext(...)
    local sni_list = {}
    local sni_ext = { type = TLS_EXT_SERVER_NAME, dis = { list = sni_list } }

    local n = select("#", ...)
    for i = 1, n do
        local arg = select(i, ...)

        if type(arg) == "string" then
            sni_list[#sni_list + 1] = { name = arg, type = 0 }
        end

        if type(arg) == "number" and #sni_list > 0 then
            sni_list[#sni_list].type = arg
        end
    end

    return sni_ext
end



function tls_client_hello_mutate(ctx, desync)
    if not desync.dis.tcp then
        -- do not cutoff on related icmp
        if not desync.dis.icmp then instance_cutoff_shim(ctx, desync) end
        return
    end

    direction_cutoff_opposite(ctx, desync)

    if direction_check(desync) then
        if not desync.arg.ops then
            error("tls_client_hello_mutate: 'ops' arg required")
        end
        
        if desync.l7payload == "tls_client_hello" then
            local id = desync.arg.blob or "reasm_data"

            if not desync.tls_client_hello_mutate_dissects then desync.tls_client_hello_mutate_dissects = {} end
            local tdis = desync.tls_client_hello_mutate_dissects[id]

            if not tdis then
                tdis = tls_dissect(desync[id] or _G[id] or desync.dis.payload)

                local fallback_retry = false
                while not tdis or not tdis.handshake or not tdis.handshake[TLS_HANDSHAKE_TYPE_CLIENT] do
                    if desync.arg.fallback and not fallback_retry then
                        tdis = tls_dissect(blob(desync, desync.arg.fallback))
                        fallback_retry = true
                    else
                        error("tls_client_hello_mutate: could not dissect tls")
                    end
                end

                desync.tls_client_hello_mutate_dissects[id] = tdis
            end

            local reconstruction_needed = true

            for op in string.gmatch(desync.arg.ops, "[%w_]+%(.-%)") do
                local func, args_str = string.match(op, "([%w_]+)%((.-)%)")

                local args = {}
                for arg in string.gmatch(args_str, "[^,]+") do
                    table.insert(args, arg)
                end

                local value, target, key = get_by_path(tdis, args[1])
                local available = target and key

                if func == "get" then

                    desync[args[2]] = value
                    reconstruction_needed = false

                elseif func == "set" and available then

                    target[key] = desync[args[2]] or _G[args[2]]

                elseif func == "set_str" and available then

                    target[key] = args[2]

                elseif func == "set_num" and available then

                    target[key] = tonumber(args[2])

                elseif func == "set_bool" and available then

                    target[key] = args[2] == "true"

                elseif func == "set_nil" and available then

                    target[key] = nil

                elseif func == "rnd" and available then

                    if type(value) ~= "string" then
                        error("tls_client_hello_mutate: rnd: target must be a string")
                    end

                    target[key] = brandom(#value)

                elseif func == "insert" and available then

                    table.insert(target, key, desync[args[2]] or _G[args[2]])

                elseif func == "insert_str" and available then

                    table.insert(target, key, args[2])

                elseif func == "insert_num" and available then

                    table.insert(target, key, tonumber(args[2]))

                elseif func == "insert_bool" and available then

                    table.insert(target, key, args[2] == "true")

                elseif func == "remove" and available then

                    table.remove(target, key)

                elseif func == "shuffle" and available then

                    shuffle(value)

                end
            end

            if reconstruction_needed and desync.arg.blob then
                local fake = tls_reconstruct(tdis)

                if not fake then
                    error("tls_client_hello_mutate: reconstruct error")
                end

                desync[desync.arg.blob] = fake
            end
        end
    end
end



function timeout(ctx, desync)
    if not desync.track then return end

    local state = desync.track.lua_state

    if not state.timeout then
        state.timeout = {}
    end

    if state.timeout.cancel then
        state.timeout.cancel()
    end

    if not state.timeout.skip then
        if desync.arg.callback and not state.timeout.callback then
            local fname = desync.func_instance .. "__timeout_callback"

            if not _G[fname] then
                local fn, err = load(desync.arg.callback, fname)

                if not fn then
                    error(err)
                end

                _G[fname] = fn
            end

            state.timeout.callback = fname
        end

        if desync.arg.reset and not state.timeout.reset then
            local dis = deepcopy(desync.dis)
            dis_reverse(dis)

            dis.payload = nil
            dis.tcp.th_flags = TH_RST
            dis.tcp.th_win = desync.track and desync.track.pos.reverse.tcp.winsize or 64
            dis.tcp.options = nil

            if dis.ip6 then
                dis.ip6.ip6_flow = (desync.track and desync.track.pos.reverse.ip6_flow) and desync.track.pos.reverse.ip6_flow or 0x60000000
            end

            state.timeout.reset = { dis = dis, opts = { ifout = desync.ifin } }
        end

        local is_reset = bitand(desync.dis.tcp.th_flags, TH_RST) ~= 0

        if desync.outgoing then
            if is_reset then return end

            state.timeout.cancel = delayed(
                function(data)
                    if data.timeout.callback then
                        execf(data.timeout.callback, data.desync)
                    end

                    if data.timeout.reset then
                        rawsend_dissect(data.timeout.reset.dis, data.timeout.reset.opts)
                    end
                end,
                tonumber(desync.arg.ms) or 3000,
                { desync = desync, timeout = state.timeout }
            )
        else
            state.timeout.skip = true

            if desync.arg.rst_trigger and is_reset then
                execf(state.timeout.callback, desync)
            end
        end
    end
end



function call(ctx, desync)
    if not desync.arg.fn then
        error("call: 'fn' arg required")
    end

    return _G[desync.arg.fn](ctx, desync)
end



mem = (
    function()
        local DEF_TTL = 300000

        local mem_cache, mem_set_ttl, mem_set_touch = memoize(function(memkey)
            return {}
        end, DEF_TTL)

        return function(ctx, desync)
            if not desync.arg.get then
                error("mem: 'get' arg required")
            end

            if not desync.arg.set then
                error("mem: 'set' arg required")
            end

            if desync.arg.ttl then
                mem_set_ttl(tonumber(desync.arg.ttl))
            else
                mem_set_ttl(DEF_TTL)
            end

            if desync.arg.touch then
                mem_set_touch(true)
            else
                mem_set_touch(false)
            end

            local key = desync.arg.key or host_ip(desync)
            local memkey = key .. "__" .. desync.arg.get
            local memval = mem_cache(memkey)

            local fname = desync.func_instance .. "__mem_set"

            if not _G[fname] then
                local fn, err = load(desync.arg.set, fname)

                if not fn then
                    error(err)
                end

                _G[fname] = fn
            end

            if memval.value == nil then
                memval.value = execf(fname, desync)
            end

            desync[desync.arg.get] = memval.value
        end
    end
)()