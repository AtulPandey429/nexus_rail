export class RwaPerpsService {
  static getPerpsQuote(): never {
    throw new Error('Perpetual quotes are not connected to a provider.');
  }
}
