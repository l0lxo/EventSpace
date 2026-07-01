export const formatKES = (amount) =>
  `KES ${Number(amount ?? 0).toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
