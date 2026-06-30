import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import Card from '../../components/shared/Card';
import Input from '../../components/shared/Input';
import Select from '../../components/shared/Select';
import Button from '../../components/shared/Button';
import StatusBadge from '../../components/shared/StatusBadge';

const buildRequestKey = (filters, page) => JSON.stringify({ filters, page });

const UserRow = ({ user, onUpdated, onDeleted }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleToggleDisabled = () => {
    setIsSubmitting(true);
    setError('');
    api
      .patch(`/admin/users/${user.id}/disable`, { isDisabled: !user.isDisabled })
      .then(({ data }) => onUpdated(user.id, { isDisabled: data.user.isDisabled }))
      .catch((err) => setError(err.response?.data?.message ?? 'Could not update this user.'))
      .finally(() => setIsSubmitting(false));
  };

  const handleDelete = () => {
    setIsSubmitting(true);
    setError('');
    api
      .delete(`/admin/users/${user.id}`)
      .then(() => onDeleted(user.id))
      .catch((err) => setError(err.response?.data?.message ?? 'Could not delete this user.'))
      .finally(() => {
        setIsSubmitting(false);
        setConfirmingDelete(false);
      });
  };

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="py-3 pr-4">
        <p className="text-text">{user.name}</p>
        <p className="text-text-muted text-xs">{user.email}</p>
      </td>
      <td className="py-3 pr-4 text-text-muted capitalize">{user.role}</td>
      <td className="py-3 pr-4">
        <StatusBadge status={user.isDisabled ? 'disabled' : 'active'} />
      </td>
      <td className="py-3 pr-4 font-mono text-text-muted">
        {format(parseISO(user.registrationDate), 'MMM d, yyyy')}
      </td>
      <td className="py-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant={user.isDisabled ? 'success' : 'warning'}
            size="sm"
            isLoading={isSubmitting}
            onClick={handleToggleDisabled}
          >
            {user.isDisabled ? 'Re-enable' : 'Disable'}
          </Button>
          {!confirmingDelete && (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
          {confirmingDelete && (
            <>
              <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleDelete}>
                Confirm delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </td>
    </tr>
  );
};

const EMPTY_FILTERS = { search: '', role: '' };

const UserManagement = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], totalPages: 1 });
  const [error, setError] = useState('');
  const [loadedKey, setLoadedKey] = useState(null);

  const [prevAppliedFilters, setPrevAppliedFilters] = useState(appliedFilters);
  if (appliedFilters !== prevAppliedFilters) {
    setPrevAppliedFilters(appliedFilters);
    setPage(1);
  }

  const requestKey = buildRequestKey(appliedFilters, page);
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const timeout = setTimeout(() => setAppliedFilters(filters), 300);
    return () => clearTimeout(timeout);
  }, [filters]);

  useEffect(() => {
    let active = true;
    const key = buildRequestKey(appliedFilters, page);
    const params = { page };
    if (appliedFilters.search) params.search = appliedFilters.search;
    if (appliedFilters.role) params.role = appliedFilters.role;

    api
      .get('/admin/users', { params })
      .then(({ data }) => {
        if (!active) return;
        setResult(data);
        setError('');
        setLoadedKey(key);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load users. Please try again.');
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleUpdated = (userId, patch) => {
    setResult((prev) => ({
      ...prev,
      data: prev.data.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
    }));
  };

  const handleDeleted = (userId) => {
    setResult((prev) => ({ ...prev, data: prev.data.filter((u) => u.id !== userId) }));
  };

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">User Management</h1>

      <div className="flex flex-wrap gap-3 items-end mb-6">
        <Input
          label="Search"
          placeholder="Name or email"
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-56"
        />
        <Select
          label="Role"
          value={filters.role}
          onChange={(e) => updateFilter('role', e.target.value)}
          className="w-40"
        >
          <option value="">All roles</option>
          <option value="student">Student</option>
          <option value="organizer">Organizer</option>
          <option value="admin">Admin</option>
        </Select>
      </div>

      {isLoading && <p className="text-text-muted">Loading users…</p>}
      {!isLoading && error && <p className="text-danger">{error}</p>}
      {!isLoading && !error && result.data.length === 0 && (
        <p className="text-text-muted">No users found.</p>
      )}

      {!isLoading && !error && result.data.length > 0 && (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Registered</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((user) => (
                    <UserRow key={user.id} user={user} onUpdated={handleUpdated} onDeleted={handleDeleted} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {result.totalPages > 1 && (
            <div className="flex gap-3 items-center justify-center mt-6">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm font-mono text-text-muted">
                Page {page} of {result.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserManagement;
