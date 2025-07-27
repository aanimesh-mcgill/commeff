import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ 
  size = 'md', 
  variant = 'primary', 
  text = '', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const variantClasses = {
    primary: 'text-primary-600',
    secondary: 'text-gray-600',
    white: 'text-white',
    dark: 'text-gray-900'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 
        className={`${sizeClasses[size]} ${variantClasses[variant]} animate-spin`} 
      />
      {text && (
        <p className={`mt-2 text-sm ${variantClasses[variant]}`}>
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner; 