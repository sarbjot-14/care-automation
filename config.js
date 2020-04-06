const port = process.env.PORT ||3000 ;
const baseURL = `http://localhost:${port}`;
module.exports = {
  // The secret for the encryption of the jsonwebtoken
  JWTsecret: 'mysecret',
  baseURL: baseURL,
  port: port,
  // The credentials and information for OAuth2
  oauth2Credentials: {
    client_id: "778678380629-6re9hj4uk9ef5h4f933brc8oop9bka1t.apps.googleusercontent.com",
    project_id: "love-and-care-automation", // The name of your project
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: "xQNcTztnTjP39y6DBPg9grH0",
    redirect_uris: [
      `${baseURL}/auth_callback`
    ],
    scopes: [
        //'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/drive'
    ]
  }
};