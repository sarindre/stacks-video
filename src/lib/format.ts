/** Whole-dollar amounts for summaries. Prices are entered in one currency; the app doesn't convert. */
export const money = (n: number): string => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** Exact amounts (a price paid or a target) keep their cents when they have any. */
export const price = (n: number): string => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

export const signedMoney = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`
