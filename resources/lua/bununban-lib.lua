function shuffle(tbl)
    for i = #tbl, 2, -1 do
        local j = math.random(i)
        tbl[i], tbl[j] = tbl[j], tbl[i]
    end
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



function create_fake_dns(domains, is_tcp)
    local id = "\x00\x00"
    local flags = "\x00\x00"

    if #domains == 1 then
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



local pick_random_domain = create_shuffled_bag({
    "steampowered.com",
    "github.com",
    "figma.com",
    "xda-developers.com",
    "rozetked.me",
    "comss.ru",
})

function switch_domain4fakes()
    _G.domain4fakes = pick_random_domain()
end

switch_domain4fakes()

function debounced_switch_domain4fakes()
    timer_set("switch_domain4fakes", "switch_domain4fakes", 60000, true)
end