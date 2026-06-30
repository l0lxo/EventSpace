import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import AuthBackdrop from '../../components/auth/AuthBackdrop';
import Card from '../../components/shared/Card';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ email, password }) => {
    setServerError('');
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? '/events', { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Login failed. Please try again.');
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <AuthBackdrop className="h-[200px] md:h-auto md:w-1/2" />

      <div className="md:w-1/2 flex items-center justify-center p-4 sm:p-10 bg-white">
        <Card className="w-full max-w-sm">
          <h1 className="font-display text-2xl text-text mb-5">Log in</h1>

          {location.state?.loggedOut && (
            <p className="text-sm text-success mb-4">You've been logged out.</p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@strathmore.edu"
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
            />
            <Input
              label="Password"
              type="password"
              error={errors.password?.message}
              {...register('password', { required: 'Password is required' })}
            />

            {serverError && <p className="text-sm text-danger">{serverError}</p>}

            <Button type="submit" isLoading={isSubmitting} className="w-full">
              Log in
            </Button>
          </form>

          <p className="text-sm text-text-muted mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent">Register</Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Login;
