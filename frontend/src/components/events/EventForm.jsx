import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { format, addDays } from 'date-fns';
import { EVENT_CATEGORIES } from '../../utils/constants';
import { getPosterUrl } from '../../utils/media';
import Input from '../shared/Input';
import Select from '../shared/Select';
import Button from '../shared/Button';

const ADVANCE_NOTICE_DAYS = 14;

const EventForm = ({ defaultValues, onSubmit, submitLabel, enforceAdvanceNotice }) => {
  const [serverError, setServerError] = useState('');
  const [posterFile, setPosterFile] = useState(null);
  const fileInputRef = useRef(null);
  const [posterPreview, setPosterPreview] = useState(getPosterUrl(defaultValues?.posterUrl));
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues });

  const fundingRequested = watch('fundingRequested');
  const guestsRequested = watch('guestsRequested');
  const isPaid = watch('isPaid');

  // 14-day rule only applies to new events, not edits — see Event.js's isNew date validator
  const minDate = enforceAdvanceNotice
    ? format(addDays(new Date(), ADVANCE_NOTICE_DAYS), 'yyyy-MM-dd')
    : undefined;

  const handlePosterChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setPosterFile(file);
    setPosterPreview(file ? URL.createObjectURL(file) : getPosterUrl(defaultValues?.posterUrl));
  };

  const submit = async (values) => {
    setServerError('');
    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('description', values.description);
    formData.append('date', values.date);
    formData.append('time', values.time);
    formData.append('location', values.location);
    formData.append('capacity', Number(values.capacity));
    formData.append('category', values.category);
    formData.append(
      'fundingRequest',
      JSON.stringify(
        values.fundingRequested
          ? {
              requested: true,
              budget: Number(values.fundingBudget),
              justification: values.fundingJustification,
            }
          : { requested: false }
      )
    );
    formData.append(
      'externalGuests',
      JSON.stringify(
        values.guestsRequested
          ? { requested: true, reason: values.guestsReason }
          : { requested: false }
      )
    );
    formData.append('isPaid', values.isPaid ? 'true' : 'false');
    if (values.isPaid && values.price) {
      formData.append('price', values.price);
    }
    if (posterFile) {
      formData.append('poster', posterFile);
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Poster (optional)
        </label>
        {posterPreview && (
          <img
            src={posterPreview}
            alt=""
            className="w-full max-w-xs h-40 object-cover rounded-sm border border-border mb-2"
          />
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-sm font-medium bg-white border border-border rounded-sm text-text hover:bg-surface transition-colors"
          >
            Choose file
          </button>
          <span className="text-sm text-text-muted truncate">
            {posterFile ? posterFile.name : defaultValues?.posterUrl ? 'Using current poster' : 'No file chosen'}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePosterChange}
          className="sr-only"
        />
      </div>

      <Input
        label="Title"
        error={errors.title?.message}
        {...register('title', {
          required: 'Title is required',
          maxLength: { value: 150, message: 'Title cannot exceed 150 characters' },
        })}
      />

      <div>
        <label className="block text-sm font-medium text-text mb-1">Description</label>
        <textarea
          rows={4}
          className={`w-full px-3 py-2 text-sm font-body border rounded-sm bg-white text-text ${
            errors.description ? 'border-danger' : 'border-border'
          }`}
          {...register('description', {
            required: 'Description is required',
            maxLength: { value: 3000, message: 'Description cannot exceed 3000 characters' },
          })}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          label="Date"
          type="date"
          min={minDate}
          error={errors.date?.message}
          className="flex-1"
          {...register('date', { required: 'Date is required' })}
        />
        <Input
          label="Time"
          type="time"
          error={errors.time?.message}
          className="flex-1"
          {...register('time', { required: 'Time is required' })}
        />
      </div>
      {enforceAdvanceNotice && (
        <p className="text-xs text-text-muted -mt-2">
          Events must be scheduled at least {ADVANCE_NOTICE_DAYS} days from today.
        </p>
      )}

      <Input
        label="Location"
        error={errors.location?.message}
        {...register('location', { required: 'Location is required' })}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          label="Capacity"
          type="number"
          min={1}
          error={errors.capacity?.message}
          className="flex-1"
          {...register('capacity', {
            required: 'Capacity is required',
            min: { value: 1, message: 'Capacity must be at least 1' },
          })}
        />
        <Select
          label="Category"
          error={errors.category?.message}
          className="flex-1"
          {...register('category', { required: 'Category is required' })}
        >
          <option value="">Select a category</option>
          {EVENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </Select>
      </div>

      <div className="border border-border rounded-md p-4">
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" className="h-4 w-4 accent-accent" {...register('fundingRequested')} />
          Requesting funding for this event?
        </label>

        {fundingRequested && (
          <div className="mt-3 space-y-3">
            <Input
              label="Budget (KES)"
              type="number"
              min={0}
              error={errors.fundingBudget?.message}
              {...register('fundingBudget', {
                required: 'Budget is required when requesting funding',
                min: { value: 0, message: 'Budget cannot be negative' },
              })}
            />
            <div>
              <label className="block text-sm font-medium text-text mb-1">Justification</label>
              <textarea
                rows={3}
                className={`w-full px-3 py-2 text-sm font-body border rounded-sm bg-white text-text ${
                  errors.fundingJustification ? 'border-danger' : 'border-border'
                }`}
                {...register('fundingJustification', {
                  required: 'Justification is required when requesting funding',
                  maxLength: { value: 1000, message: 'Justification cannot exceed 1000 characters' },
                })}
              />
              {errors.fundingJustification && (
                <p className="mt-1 text-xs text-danger">{errors.fundingJustification.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border border-border rounded-md p-4">
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" className="h-4 w-4 accent-accent" {...register('isPaid')} />
          This is a paid event
        </label>

        {isPaid && (
          <div className="mt-3">
            <Input
              label="Ticket price (KES)"
              type="number"
              min={1}
              step="0.01"
              error={errors.price?.message}
              {...register('price', {
                required: 'Price is required for paid events',
                min: { value: 0.01, message: 'Price must be greater than 0' },
              })}
            />
          </div>
        )}
      </div>

      <div className="border border-border rounded-md p-4">
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" className="h-4 w-4 accent-accent" {...register('guestsRequested')} />
          Inviting guests from outside the university?
        </label>

        {guestsRequested && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-text mb-1">Reason</label>
            <textarea
              rows={3}
              className={`w-full px-3 py-2 text-sm font-body border rounded-sm bg-white text-text ${
                errors.guestsReason ? 'border-danger' : 'border-border'
              }`}
              {...register('guestsReason', {
                required: 'Reason is required when inviting external guests',
                maxLength: { value: 1000, message: 'Reason cannot exceed 1000 characters' },
              })}
            />
            {errors.guestsReason && (
              <p className="mt-1 text-xs text-danger">{errors.guestsReason.message}</p>
            )}
          </div>
        )}
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <Button type="submit" isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
};

export default EventForm;
