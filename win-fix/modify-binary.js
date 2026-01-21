import modifyBinarySubsystem from '../src/backend/utils/modifyBinarySubsystem'

// Usage: Provide the path to the binary
if( process.argv.length !== 3 ){
	console.log('Usage: node modify-binary.js <path-to-binary>');
	process.exit(1);
}

const binaryPath = process.argv[2];
modifyBinarySubsystem(binaryPath);

console.log('Successfully modified the binary to hide the console at startup.');