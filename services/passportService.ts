import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthController, User } from '../controllers/AuthController';

export class PassportService {
  public static initPassport(): void {
    // Passport session serialization
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser((id: number, done) => {
      const user = AuthController.findUserById(id);
      done(null, user || null);
    });

    // Configure Google OAuth Strategy if credentials are present
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (googleClientId && googleClientSecret) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      passport.use(
        new GoogleStrategy(
          {
            clientID: googleClientId,
            clientSecret: googleClientSecret,
            callbackURL: `${appUrl}/auth/google/callback`
          },
          (accessToken, refreshToken, profile, done) => {
            try {
              const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@google.miral.sa`;
              const name = profile.displayName || profile.name?.givenName || 'مستخدم جوجل';
              const user = AuthController.findOrCreateSocialUser({
                provider: 'Google',
                email,
                name
              });
              return done(null, user);
            } catch (err) {
              return done(err as Error, undefined);
            }
          }
        )
      );
      console.log('🔒 [Passport.js] Google OAuth Strategy initialized successfully.');
    } else {
      console.log('ℹ️ [Passport.js] GOOGLE_CLIENT_ID not detected. Social login will run in Demo/Simulation Mode.');
    }

    // Configure Apple OAuth Strategy if credentials are present
    const appleClientId = process.env.APPLE_CLIENT_ID;
    const appleTeamId = process.env.APPLE_TEAM_ID;
    const appleKeyId = process.env.APPLE_KEY_ID;
    const applePrivateKey = process.env.APPLE_PRIVATE_KEY;

    if (appleClientId && appleTeamId && appleKeyId && applePrivateKey) {
      try {
        // Dynamic import or AppleStrategy setup
        const AppleStrategy = require('passport-apple');
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        passport.use(
          new AppleStrategy(
            {
              clientID: appleClientId,
              teamID: appleTeamId,
              keyID: appleKeyId,
              privateKeyString: applePrivateKey,
              callbackURL: `${appUrl}/auth/apple/callback`,
              scope: ['name', 'email']
            },
            (req: any, accessToken: string, refreshToken: string, idToken: any, profile: any, done: any) => {
              const email = idToken?.email || profile?.email || `user_${Date.now()}@apple.miral.sa`;
              const name = profile?.name ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim() : 'مستخدم أبل';
              const user = AuthController.findOrCreateSocialUser({
                provider: 'Apple',
                email,
                name: name || 'مستخدم أبل'
              });
              return done(null, user);
            }
          )
        );
        console.log('🔒 [Passport.js] Apple OAuth Strategy initialized successfully.');
      } catch (e) {
        console.warn('⚠️ [Passport.js] Could not initialize Apple strategy:', e);
      }
    } else {
      console.log('ℹ️ [Passport.js] APPLE_CLIENT_ID not detected. Apple login will run in Demo/Simulation Mode.');
    }
  }
}
