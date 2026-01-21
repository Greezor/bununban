import fs from 'node:fs'

const IMAGE_SUBSYSTEM_WINDOWS_GUI = 2;
const PE_HEADER_OFFSET_LOCATION = 0x3C;
const SUBSYSTEM_OFFSET = 0x5C;

export default filePath => {
	const fd = fs.openSync(filePath, 'r+');
	const buffer = Buffer.alloc(4);

	// Read PE header offset from 0x3C
	fs.readSync(fd, buffer, 0, 4, PE_HEADER_OFFSET_LOCATION);
	const peHeaderOffset = buffer.readUInt32LE(0);

	// Seek to the subsystem field in the PE header
	const subsystemOffset = peHeaderOffset + SUBSYSTEM_OFFSET;
	const subsystemBuffer = Buffer.alloc(2);
	subsystemBuffer.writeUInt16LE(IMAGE_SUBSYSTEM_WINDOWS_GUI, 0);

	// Write the new subsystem value
	fs.writeSync(fd, subsystemBuffer, 0, 2, subsystemOffset);

	fs.closeSync(fd);
}