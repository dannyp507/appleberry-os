import { auth } from './firebase';

export async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('You must be signed in to perform this action.');
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
