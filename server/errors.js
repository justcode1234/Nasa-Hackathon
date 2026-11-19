export class AppError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// One definition, because the retry ladder in context/farms.js and the sentence in nasa/power.js must not disagree
// about what asking again can fix: 408 and 429 are a service asking to be asked again, every other 4xx is one that
// read the request and declined it, and 5xx says the service itself is in trouble.
export function isPermanentRefusal(status) {
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 408 && status !== 429;
}
