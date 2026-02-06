export function filterPersonalShifts(data, userId) {
	const shifts = Array.isArray(data?.value) ? data.value : [];

	return shifts.filter((shift) => {
		if (!shift) return false;
		if (shift.userId !== userId) return false;
		if (shift.isStagedForDeletion) return false;
		return true;
	});
}
