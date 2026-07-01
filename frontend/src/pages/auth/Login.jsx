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
    <AuthBackdrop className="min-h-screen">
      <div className="h-full flex items-center justify-center p-4 sm:p-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-sm text-text underline block mb-3">← Go back home</Link>
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
            <Link to="/register" className="text-text underline">Register</Link>
          </p>
        </Card>
        </div>
      </div>
    </AuthBackdrop>
  );
};

export default Login;
