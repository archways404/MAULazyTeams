const LEVELS = { off: 0, error: 1, info: 2, verbose: 3, trace: 4 };
export function createLogger(debugOpts) {
	const level = LEVELS[debugOpts.mode] ?? 0;

	return {
		error: (...a) => level >= 1 && console.error(...a),
		info: (...a) => level >= 2 && console.log(...a),
		verbose: (...a) => level >= 3 && console.log(...a),
		trace: (...a) => level >= 4 && console.log(...a),
	};
}
