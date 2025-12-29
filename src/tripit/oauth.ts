/**
 * OAuth 1.0a implementation for TripIt API.
 *
 * TripIt uses HMAC-SHA1 signatures with a ±3 hour timestamp tolerance
 * and 80-character maximum nonce.
 */

import OAuth from 'oauth-1.0a';

const REQUEST_TOKEN_URL = 'https://api.tripit.com/oauth/request_token';
const AUTHORIZE_URL = 'https://www.tripit.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.tripit.com/oauth/access_token';

export class TripItOAuth {
  private oauth: OAuth;

  constructor(
    private consumerKey: string,
    private consumerSecret: string
  ) {
    this.oauth = new OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: 'HMAC-SHA1',
      hash_function: (baseString: string, key: string) => {
        // Use Web Crypto API for HMAC-SHA1
        return this.hmacSha1(baseString, key);
      },
    });
  }

  private async hmacSha1(message: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  async getRequestToken(callbackUrl: string): Promise<{
    token: string;
    tokenSecret: string;
  }> {
    const requestData = {
      url: REQUEST_TOKEN_URL,
      method: 'POST' as const,
      data: { oauth_callback: callbackUrl },
    };

    const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData));

    const response = await fetch(REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get request token: ${text}`);
    }

    const text = await response.text();
    const params = new URLSearchParams(text);

    const token = params.get('oauth_token');
    const tokenSecret = params.get('oauth_token_secret');

    if (!token || !tokenSecret) {
      throw new Error('Invalid request token response');
    }

    return { token, tokenSecret };
  }

  getAuthorizationUrl(requestToken: string): string {
    return `${AUTHORIZE_URL}?oauth_token=${requestToken}`;
  }

  async getAccessToken(
    requestToken: string,
    requestTokenSecret: string,
    verifier: string
  ): Promise<{ token: string; tokenSecret: string }> {
    const requestData = {
      url: ACCESS_TOKEN_URL,
      method: 'POST' as const,
    };

    const authHeader = this.oauth.toHeader(
      this.oauth.authorize(requestData, {
        key: requestToken,
        secret: requestTokenSecret,
      })
    );

    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `oauth_verifier=${verifier}`,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get access token: ${text}`);
    }

    const text = await response.text();
    const params = new URLSearchParams(text);

    const token = params.get('oauth_token');
    const tokenSecret = params.get('oauth_token_secret');

    if (!token || !tokenSecret) {
      throw new Error('Invalid access token response');
    }

    return { token, tokenSecret };
  }

  signRequest(
    method: string,
    url: string,
    accessToken: string,
    accessTokenSecret: string
  ): Record<string, string> {
    return this.oauth.toHeader(
      this.oauth.authorize(
        { url, method },
        { key: accessToken, secret: accessTokenSecret }
      )
    ) as Record<string, string>;
  }
}
