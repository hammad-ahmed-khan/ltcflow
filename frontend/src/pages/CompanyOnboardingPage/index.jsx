// ===================================================================
// frontend/src/pages/CompanyOnboarding/index.jsx
// ===================================================================
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useToasts } from 'react-toast-notifications';
import Div100vh from 'react-div-100vh';
import CompanyOnboardingWizard from '../../components/CompanyOnboardingWizard';
import Credits from '../Login/components/Credits';
import Logo from '../Login/components/Logo';
import getInfo from '../../actions/getInfo';
import backgroundImage from '../../assets/background.jpg';
import './CompanyOnboarding.sass';

function CompanyOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToasts();
  
  const [info, setInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get app info on mount
  useEffect(() => {
    getInfo()
      .then((res) => {
        setInfo(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading app info:', err);
        setError('Unable to load application information');
        setLoading(false);
      });
  }, []);

  // Handle successful onboarding completion
  const handleOnboardingComplete = (data) => {
    console.log('Onboarding completed:', data);

    // Show success toast
    addToast(
      <div>
        <strong>Welcome to {info.appTitle || 'LTC Flow'}!</strong>
        <br />
        Your company "{data.company.name}" has been created successfully.
      </div>,
      {
        appearance: 'success',
        autoDismiss: false,
      }
    );

    // Store company data for success page
    sessionStorage.setItem('newCompanyData', JSON.stringify({
      company: data.company,
      admin: data.admin,
      summary: data.summary,
      timestamp: new Date().toISOString()
    }));

    // Navigate to success page
    navigate('/onboarding/success', { 
      state: { 
        companyData: data,
        fromOnboarding: true 
      },
      replace: true
    });
  };

  // Handle onboarding errors
  const handleOnboardingError = (error) => {
    console.error('Onboarding error:', error);
    
    let errorMessage = 'There was an error completing your onboarding. Please try again.';
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    addToast(
      <div>
        <strong>Onboarding Failed</strong>
        <br />
        {errorMessage}
      </div>,
      {
        appearance: 'error',
        autoDismiss: true,
      }
    );
  };

  // Loading state
  if (loading) {
    return (
      <Div100vh>
        <div className="uk-height-1-1 uk-flex uk-flex-middle uk-flex-center uk-background-muted">
          <div className="uk-text-center">
            <div uk-spinner="ratio: 2" className="uk-margin-bottom"></div>
            <p className="uk-text-muted">Loading onboarding...</p>
          </div>
        </div>
      </Div100vh>
    );
  }

  // Error state
  if (error) {
    return (
      <Div100vh>
        <div className="uk-height-1-1 uk-flex uk-flex-middle uk-flex-center uk-background-muted">
          <div className="uk-width-1-1 uk-width-medium@s">
            <div className="uk-card uk-card-default uk-card-body uk-text-center">
              <span className="uk-text-danger" uk-icon="icon: warning; ratio: 3"></span>
              <h3 className="uk-card-title uk-text-danger">Error Loading Onboarding</h3>
              <p className="uk-text-muted">{error}</p>
              <div className="uk-margin-top">
                <button 
                  className="uk-button uk-button-primary uk-margin-small-right"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </button>
                <Link 
                  to="/login"
                  className="uk-button uk-button-default"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Div100vh>
    );
  }

  return (
    <Div100vh>
      <div 
        className="company-onboarding uk-height-1-1"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Background overlay */}
        <div className="uk-position-cover" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}></div>
        
        {/* Header */}
        <div className="uk-position-relative uk-padding uk-text-center" style={{ zIndex: 10 }}>
          <div className="uk-container uk-container-small">
            {/* Logo and title */}
            <div className="uk-margin-bottom">
              <Logo info={info} />
              <h1 className="uk-heading-medium uk-text-emphasis uk-margin-remove-top uk-margin-small-bottom">
                Create Your Company
              </h1>
              <p className="uk-text-large uk-text-muted">
                Set up your secure communication platform in just a few steps
              </p>
            </div>

            {/* Navigation breadcrumb */}
            <nav aria-label="Breadcrumb">
              <ul className="uk-breadcrumb uk-flex-center uk-text-small">
                <li>
                  <Link to="/" className="uk-text-muted">
                    <span uk-icon="home"></span>
                    Home
                  </Link>
                </li>
                <li>
                  <span className="uk-text-emphasis">Company Setup</span>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Main wizard content */}
        <div className="uk-position-relative" style={{ zIndex: 10 }}>
          <div className="uk-container uk-container-expand uk-padding-remove-horizontal">
            {/* Wizard wrapper with UIKit styling */}
            <div className="uk-card uk-card-default uk-margin-large-top uk-margin-large-bottom">
              <div className="wizard-container">
                <CompanyOnboardingWizard
                  onComplete={handleOnboardingComplete}
                  onError={handleOnboardingError}
                  initialData={location.state?.initialData || {}}
                  appInfo={info}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Help section */}
        <div className="uk-position-relative uk-padding uk-text-center" style={{ zIndex: 10 }}>
          <div className="uk-container uk-container-small">
            <div className="uk-card uk-card-default uk-card-body uk-card-small">
              <div className="uk-grid-small uk-flex-middle uk-grid" uk-grid="">
                <div className="uk-width-auto">
                  <span className="uk-text-primary" uk-icon="icon: info; ratio: 1.2"></span>
                </div>
                <div className="uk-width-expand">
                  <p className="uk-text-small uk-margin-remove">
                    Need help? Contact our support team at{' '}
                    <a href="mailto:support@ltcflow.com" className="uk-text-primary">
                      support@ltcflow.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer credits */}
        <div className="uk-position-relative uk-padding uk-text-center" style={{ zIndex: 10 }}>
          <Credits />
        </div>

        {/* Back to login link */}
        <div className="uk-position-top-right uk-position-small" style={{ zIndex: 20 }}>
          <Link 
            to="/login"
            className="uk-button uk-button-default uk-button-small"
            uk-tooltip="Already have an account?"
          >
            <span uk-icon="arrow-left"></span>
            Back to Login
          </Link>
        </div>
      </div>
    </Div100vh>
  );
}

export default CompanyOnboarding;