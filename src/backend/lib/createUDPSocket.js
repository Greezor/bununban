export default async ({ hostname, port, queueBatchSize = 32, keepAliveInterval = 500, onData, onError, onClose }) => {
	let socket
	let keepAlive = true

	const queue = []

	const processQueue = () => {
		while(queue.length){
			if( socket?.closed ?? true )
				break;

			try{
				const processed = socket.sendMany(
					queue.slice(0, queueBatchSize).flat()
				);

				queue.splice(0, processed);

				if( processed < queueBatchSize )
					break;
			}
			catch(e){
				break;
			}
		}
	}

	const options = {
		hostname,
		port,
		socket: {
			data(socket, buf, port, addr)
			{
				onData?.(buf, port, addr, socket);
			},

			error(socket, error)
			{
				onError?.(error, socket);
			},
		},
	}

	socket = await Bun.udpSocket(options);

	setTimeout(async () => {
		while(keepAlive){
			if( socket?.closed ?? true )
				socket = await Bun.udpSocket(options);

			processQueue();

			await Bun.sleep(keepAliveInterval);
		}
	});

	return {
		send: (buf, port, addr) => {
			queue.push([ buf, port, addr ]);
			processQueue();
		},

		multiSend: args => {
			for(const [ buf, port, addr ] of args)
				queue.push([ buf, port, addr ]);

			processQueue();
		},

		close: () => {
			if( !keepAlive )
				return;

			keepAlive = false;
			queue.splice(0, queue.length);

			if( !!socket && !socket.closed )
				socket.close();

			onClose?.();
		},

		getBunSocket: () => socket,
	};
}