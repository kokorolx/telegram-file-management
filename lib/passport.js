import passport from 'passport';
import LocalStrategy from 'passport-local';
import { getUserByUsername, getUserById } from './db';
import bcrypt from 'bcryptjs';

// LocalStrategy for username/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
    },
    async (username, password, done) => {
      try {
        const user = await getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
          return done(null, false, { message: 'Incorrect password' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
