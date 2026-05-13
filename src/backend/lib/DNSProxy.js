import { join } from 'node:path'

import { DohResolver } from 'dohjs'
import { decode, encode, AUTHORITATIVE_ANSWER } from '@dnsquery/dns-packet'

import HostsResolver from './hostsResolver'
import createUDPSocket from './createUDPSocket'

import { APPDATA_DIR } from './appdata'

import settings from '../stores/settings'

export default class DNSProxy
{
	#socket = null

	async winSetDNS(nameservers)
	{
		if( process.platform != 'win32' )
			return;

		await Bun.$`powershell -command "${
			`$interface = Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty InterfaceAlias; Set-DnsClientServerAddress -InterfaceAlias $interface -ServerAddresses (${
				nameservers.map(ns => `'${ ns }'`).join(', ')
			})`
		}"`.nothrow().quiet();

		await Bun.$`ipconfig /flushdns; sc stop SharedAccess;`.nothrow().quiet();
	}

	async start()
	{
		if( this.#socket )
			return;

		const nameserver = await settings.get('dns.nameserver') || '8.8.8.8';
		const useDoH = await settings.get('dns.doh') ?? true;
		const dohURL = new URL(await settings.get('dns.doh-url') || 'https://dns.google/dns-query');

		const hostsPaths = ( await settings.get('dns.hosts') ?? [] )
			.map(filename => join(APPDATA_DIR, 'files', 'lists', filename));

		const hosts = new HostsResolver(hostsPaths, await settings.get('dns.hosts-mem') || 500);
		const doh = new DohResolver(dohURL.href);

		const hostsTTL = await settings.get('dns.hosts-ttl') || 0;

		await this.winSetDNS(['127.0.0.1']);

		this.#socket = await createUDPSocket({
			port: 53,
			onData: async (queryBuf, port, addr) => {
				const query = decode(queryBuf);
				const [ question ] = query.questions;
				const { name, type } = question;
		
				const response = {
					id: query.id,
					type: 'response',
					flags: AUTHORITATIVE_ANSWER,
					questions: [ question ],
					answers: [],
				};
		
				const ip = await hosts.resolve(name);
		
				if( ip ){
					response.answers.push({
						name,
						type,
						class: 'IN',
						ttl: hostsTTL,
						data: ip,
					});
				}else{
					const skipDoH = !useDoH || dohURL.hostname === name;

					try{
						if( skipDoH )
							throw 1;
		
						const { answers } = await doh.query(name, type);
		
						if( !answers.length )
							throw 0;
		
						for(const answer of answers){
							response.answers.push({
								name: answer.name || name,
								type: answer.type || type,
								class: answer.class || 'IN',
								ttl: answer.ttl || 300,
								data: answer.data || '0.0.0.0',
							});
						}
					}
					catch(e){
						if( skipDoH ){
							await new Promise(async resolve => {
								const client = await createUDPSocket({
									onClose: () => resolve(),
									onError: () => {
										clearTimeout(timeout);
										resolve();
									},
									onData: answerBuf => {
										const { answers } = decode(answerBuf);
										response.answers = answers;
		
										clearTimeout(timeout);
										client.close();
									},
								});
		
								const timeout = setTimeout(() => client.close(), 5000);
		
								client.send(queryBuf, 53, nameserver);
							});
						}
					}
				}
		
				this.#socket.send(encode(response), port, addr);
			},
		});
	}

	async stop()
	{
		if( !this.#socket )
			return;

		await this.winSetDNS(['8.8.8.8', '8.8.4.4']);

		this.#socket.close();
		this.#socket = null;
	}
}