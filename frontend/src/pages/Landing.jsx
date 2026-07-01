import { useNavigate } from 'react-router-dom';
import AuthBackdrop from '../components/auth/AuthBackdrop';
import { useAuth } from '../hooks/useAuth';

const Landing = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <AuthBackdrop className="flex-1">
      <div className="h-full flex items-start justify-center text-center px-4 pt-20 sm:pt-28">
        <div className="max-w-xl flex flex-col items-center">
          <p className="text-xs font-medium text-[#5B5550] uppercase tracking-widest mb-2">
            Strathmore University
          </p>
          <h1 className="font-display text-6xl sm:text-7xl text-[#2E2A27] leading-[1.1] mb-11">
            EventSpace
          </h1>
          <p className="text-[#4A4541] text-sm sm:text-base max-w-[400px] mb-6">
            Discover, book, and manage university events — all in one place.
          </p>
          {/* pill radius + custom fills are a deliberate one-off for this hero
              moment — built outside the shared Button component so they can't
              leak into (or accidentally inherit a stale cascade from) its
              global 6px radius cap used everywhere else in the app */}
          <div className="flex gap-4 justify-center">
            {currentUser ? (
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="px-5 py-2.5 text-sm font-medium text-on-accent rounded-full transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                Browse Events
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-5 py-2.5 text-sm font-medium text-on-accent rounded-full transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="px-5 py-2.5 text-sm font-medium text-[#2E2A27] rounded-full border transition-colors hover:bg-white/80"
                  style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.8)' }}
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthBackdrop>
  );
};

export default Landing;
