/**
 * src/pages/auth/Register.jsx
 *
 * Mirrors the validation rules in backend/routes/auth.js (registerValidation)
 * client-side for instant feedback — the backend remains the source of
 * truth and re-validates everything regardless.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/shared/Card';
import Input from '../../components/shared/Input';
import Select from '../../components/shared/Select';
import Button from '../../components/shared/Button';

const Register = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { role: 'student' } });

  const role = watch('role');

  const onSubmit = async ({ name, email, password, role, studentID, organizationName }) => {
    setServerError('');
    try {
      await registerUser({
        name,
        email,
        password,
        role,
        studentID: role === 'student' ? studentID : null,
        organizationName: role === 'organizer' ? organizationName : null,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="flex justify-center p-10">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-text mb-5">Register</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full name"
            error={errors.name?.message}
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
            })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@strathmore.edu"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@strathmore\.edu$/,
                message: 'Email must be a @strathmore.edu address',
              },
            })}
          />
          <Input
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            })}
          />
          <Select label="I am a..." {...register('role')}>
            <option value="student">Student</option>
            <option value="organizer">Event Organizer</option>
          </Select>

          {role === 'student' && (
            <Input
              label="Student ID"
              error={errors.studentID?.message}
              {...register('studentID', { required: 'Student ID is required' })}
            />
          )}
          {role === 'organizer' && (
            <Input
              label="Organization name"
              error={errors.organizationName?.message}
              {...register('organizationName', { required: 'Organization name is required' })}
            />
          )}

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Create account
          </Button>
        </form>

        <p className="text-sm text-text-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-accent">Log in</Link>
        </p>
      </Card>
    </div>
  );
};

export default Register;
