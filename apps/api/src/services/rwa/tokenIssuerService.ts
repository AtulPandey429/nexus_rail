export class RwaTokenIssuerService {
  static async issueRwaToken(): Promise<never> {
    throw new Error('Token issuance is not available. A licensed issuer and custody provider are required.');
  }
}
