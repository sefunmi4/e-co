const DEFAULT_AGE_OF_MAJORITY = 18;

const parseDate = (value?: string) => (value ? new Date(value) : undefined);

export const calculateAge = (dateOfBirth?: string) => {
  const parsed = parseDate(dateOfBirth);
  if (!parsed) {
    return undefined;
  }
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
};

export const isOfLegalAge = (dateOfBirth?: string, _country?: string) => {
  const age = calculateAge(dateOfBirth);
  if (age === undefined) {
    return false;
  }
  return age >= DEFAULT_AGE_OF_MAJORITY;
};
