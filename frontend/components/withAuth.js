import { useEffect } from 'react';
import { useRouter } from 'next/router';

const withAuth = (WrappedComponent, requiredRole = null) => {
  return (props) => {
    const router = useRouter();
    const { user } = props;

    useEffect(() => {
      // If no user, redirect to login
      if (!user) {
        router.push('/login');
        return;
      }

      // If a specific role is required and user doesn't have it, redirect
      if (requiredRole && user.role !== requiredRole) {
        // Redirect to appropriate dashboard based on role
        if (user.role === 'staff') {
          router.push('/staff');
        } else if (user.role === 'client') {
          router.push('/client');
        } else if (user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/login');
        }
      }
    }, [user, router]);

    // If no user or wrong role, don't render the component
    if (!user || (requiredRole && user.role !== requiredRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
};

export default withAuth;
