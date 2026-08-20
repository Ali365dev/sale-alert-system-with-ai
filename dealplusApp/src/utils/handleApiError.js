import { showErrorToast } from './CustomToast';

export const handleApiError = (error, errMsg = 'error', showModal) => {
  let message = 'Something went wrong. Please try again.';
  if (error.message === 'Network Error') {
    message = 'Please check your internet connection.';
  } else if (error?.response?.data?.error) {
    message = error.response.data.error;
  } else if (error?.message) {
    message = error?.message;
  }

  showErrorToast(message);
};
