import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  endIcon?: React.ReactNode;
  onEndIconClick?: () => void;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', endIcon, onEndIconClick, ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full relative">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <input 
          className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'} ${className}`}
          {...props}
        />
        {endIcon && (
          <div 
            onClick={onEndIconClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            {endIcon}
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};
