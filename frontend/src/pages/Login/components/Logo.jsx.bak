// frontend/src/pages/Login/components/Logo.jsx
// Final working version for your shielded image system

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import ltcFlowLogo from '../../../assets/flowlogo login300px.webp';
import apiClient from '../../../api/apiClient';

function Logo({ info = {} }) {
  const [companyData, setCompanyData] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const companyId = useSelector((state) => state.company?.companyId);
  
  // Load company data when companyId is available
  useEffect(() => {
    const loadCompanyData = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        console.log('🏢 Loading company data for co-branding:', companyId);
        
        const response = await apiClient.get(`/api/company/${companyId}`);
        const company = response.data.company;
        
        console.log('✅ Company data loaded for branding:', {
          name: company.name,
          hasLogo: !!company.logoInfo,
          logoInfo: company.logoInfo,
          logoShieldedID: company.logoInfo?.shieldedID
        });
        
        setCompanyData(company);
      } catch (err) {
        console.log('ℹ️ Company branding not available, using LTC Flow only');
        // Silently fall back to LTC Flow branding
      } finally {
        setLoading(false);
      }
    };

    loadCompanyData();
  }, [companyId]);

  // Get company logo URL using shielded ID system like user pictures
  const getCompanyLogoUrl = () => {
    if (companyData?.logoInfo?.shieldedID) {
      // Use the same pattern as user pictures: /api/images/{shieldedID}/256
      const logoUrl = `/api/images/${companyData.logoInfo.shieldedID}/256`;
      return logoUrl;
    }
    return null;
  };

  const companyLogoUrl = getCompanyLogoUrl();
  const hasCompanyLogo = companyLogoUrl && !imageError;

  const handleImageError = (e) => {
    console.log('🖼️ Company logo failed to load, falling back to LTC Flow only');
    setImageError(true);
  };

  // Loading state - show LTC Flow logo while loading
  if (loading) {
    return (
      <div className="uk-text-center uk-margin-medium logo">
        <img 
          src={ltcFlowLogo} 
          alt="LTC Flow" 
          style={{ maxHeight: '120px', height: 'auto' }}
        />
      </div>
    );
  }

  // Single logo layout (LTC Flow only) - default behavior
  if (!hasCompanyLogo) {
    return (
      <div className="uk-text-center uk-margin-medium logo">
        <img 
          src={ltcFlowLogo} 
          alt="LTC Flow" 
          style={{ maxHeight: '120px', height: 'auto' }}
        />
      </div>
    );
  }

  // Co-branding layout (Company Logo + LTC Flow)
  return (
    <div className="uk-text-center uk-margin-medium logo">
      <div style={{ maxWidth: '320px', margin: '0 auto' }}>
        {/* Company Logo Section */}
        <div className="uk-margin-bottom" style={{ marginBottom: '16px' }}>
          <img 
            src={companyLogoUrl}
            alt={companyData?.name || 'Company Logo'}
            onError={handleImageError}
            style={{
              maxHeight: '80px',
              maxWidth: '200px',
              height: 'auto',
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
              borderRadius: '8px',
              display: 'block',
              margin: '0 auto'
            }}
          />
          {companyData?.name && (
            <div 
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#333333',
                letterSpacing: '-0.02em',
                maxWidth: '200px',
                lineHeight: '1.2',
                textAlign: 'center',
                wordWrap: 'break-word',
                margin: '8px auto 0 auto'
              }}
            >
              {companyData.name}
            </div>
          )}
        </div>
        
        {/* Partnership Connector */}
        <div 
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            margin: '12px 0'
          }}
        >
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '0',
              right: '0',
              height: '1px',
              background: 'linear-gradient(to right, transparent, #e0e0e0 20%, #e0e0e0 80%, transparent)',
              zIndex: 1
            }}
          />
          <span 
            style={{
              background: '#f2f2f2',
              padding: '4px 16px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#888888',
              zIndex: 2,
              position: 'relative',
              border: '1px solid #e8e8e8'
            }}
          >
            powered by
          </span>
        </div>
        
        {/* LTC Flow Logo */}
        <div>
          <img 
            src={ltcFlowLogo} 
            alt="LTC Flow"
            style={{
              maxHeight: '60px',
              height: 'auto',
              opacity: '0.9',
              filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.08))'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Logo;