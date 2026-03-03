const ketchup = async (url, params = {}, responseType = 'json') => {
	let { json, signal, retry, ...subparams } = params;

	retry ??= 5;

	if( signal?.aborted )
		return;

	let response;

	try{
		response = await fetch(url, {
			body: (
				'json' in params
					? JSON.stringify(json)
					: undefined
			),
			signal,
			...subparams,
		});

		if( [408, 409, 425, 429, 500, 502, 503, 504].includes(response.status) )
			throw new Error(response.status);
	}
	catch(e){
		if( !--retry )
			throw e;

		return new Promise(resolve => {
			setTimeout(async () => {
				resolve(
					await ketchup(url, { ...params, retry }, responseType)
				);
			}, 500);
		});
	}
	
	if( responseType === 'raw' )
		return response;

	try{
		return await response[responseType]?.();
	}
	catch(e){
		return undefined;
	}
}

ketchup.arrayBuffer = (url, params = {}) => ketchup(url, params, 'arrayBuffer');
ketchup.blob = (url, params = {}) => ketchup(url, params, 'blob');
ketchup.bytes = (url, params = {}) => ketchup(url, params, 'bytes');
ketchup.formData = (url, params = {}) => ketchup(url, params, 'formData');
ketchup.json = (url, params = {}) => ketchup(url, params, 'json');
ketchup.text = (url, params = {}) => ketchup(url, params, 'text');
ketchup.raw = (url, params = {}) => ketchup(url, params, 'raw');

export default ketchup