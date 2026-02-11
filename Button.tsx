import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '',
  ...props 
}) => {
  const baseStyles = "px-4 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  
  const variants = {
    primary: "bg-red-600 text-white hover:bg-red-700 shadow-md",
    secondary: "bg-gray-800 text-white hover:bg-gray-900",
    outline: "border-2 border-red-600 text-red-600 hover:bg-red-50",
    danger: "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-md",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};