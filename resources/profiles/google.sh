--filter-l7=tls
    --hostlist-domains=play.google.com,play.googleapis.com
        --payload=tls_client_hello
            --lua-desync=tangled:scope=googleplay:fake_tls_mod=rnd,dupsid,sni=playstation.com:fake_mod=mangle_tls:qty=5-13:dup=1-2:pre=2:origsplit=sld-1:fakesplit=sld+4:seqovl=0-200:seqovl_step=10:tcp_ts_rnd:ip_id=zero

--new

--filter-l7=tls
    --hostlist={google}
        --payload=tls_client_hello
            --lua-desync=tangled:scope=google:fake_tls_mod=rnd,dupsid,sni=www.google.com:fake_mod=mangle_tls:qty=5-13:dup=1-2:pre=2:origsplit=midsld+1:fakesplit=endsld:seqovl=0-80:seqovl_step=2:tcp_ts_rnd:ip_id=zero