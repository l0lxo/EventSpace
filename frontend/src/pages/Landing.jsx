import { useNavigate } from 'react-router-dom';
import AuthBackdrop from '../components/auth/AuthBackdrop';
import Button from '../components/shared/Button';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <AuthBackdrop className="min-h-screen">
      <div className="h-full flex items-start justify-center text-center px-4 pt-20 sm:pt-28">
        <div className="max-w-xl flex flex-col items-center">
          <p className="text-xs font-medium text-accent uppercase tracking-widest mb-2">
            Strathmore University
          </p>
          <h1 className="font-display text-6xl sm:text-7xl text-text leading-[1.1] mb-11">EventSpace</h1>
          <p className="text-text-muted text-sm sm:text-base max-w-[400px] mb-6">
            Discover, book, and manage university events — all in one place.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/login')}>Log in</Button>
            <Button variant="secondary" onClick={() => navigate('/register')}>Register</Button>
          </div>
        </div>
      </div>
    </AuthBackdrop>
  );
};

export default Landing;
