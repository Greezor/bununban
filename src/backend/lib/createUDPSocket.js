export default async ({ hostname, port, queueBatchSize = 32, keepAliveInterval = 500, onData, onReopen, onError, onClose }) => {
	let socket
	let keepAlive = true

	const queue = []

	const processQueue = () => {
		const q = queue.slice();
		queue.splice(0, queue.length);

		while(q.length){
			try{
				if( socket?.closed ?? true )
					throw 1;

				const processed = socket.sendMany(
					q.slice(0, queueBatchSize).flat()
				);

				q.splice(0, processed);

				if( processed < queueBatchSize )
					throw 2;
			}
			catch(e){
				break;
			}
		}

		queue.push(...q);
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
			if( socket?.closed ?? true ){
				socket = await Bun.udpSocket(options);
				await onReopen?.();
			}

			processQueue();

			await Bun.sleep(keepAliveInterval);
		}
	});

	return {
		send: (buf, port, addr) => {
			try{
				if( socket?.closed ?? true )
					throw 1;

				socket.send(buf, port, addr);
			}
			catch(e){
				queue.push([ buf, port, addr ]);
			}
		},

		close: async () => {
			if( !keepAlive )
				return;

			keepAlive = false;
			queue.splice(0, queue.length);

			if( !!socket && !socket.closed )
				socket.close();

			await onClose?.();
		},

		getBunSocket: () => socket,
	};
}