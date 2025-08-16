 import Div100vh from 'react-div-100vh';
import Credits from './components/Credits';
import Logo from './components/Logo';
import './Login.sass';
import backgroundImage from '../../assets/background.jpg';

function NotFound() {
 
  const pageStyle = {
    backgroundImage: `url('${backgroundImage}')`,
  };

   return (
    <Div100vh>
      <div className="login uk-cover-container uk-background-secondary uk-flex uk-flex-center uk-flex-middle uk-overflow-hidden uk-light" style={pageStyle}>
        <div className="uk-position-cover uk-overlay-primary" />
        <div className="login-scrollable uk-flex uk-flex-center uk-flex-middle uk-position-z-index">
          <Credits />
          <div className="login-inner uk-width-medium uk-padding-small" data-uk-scrollspy="cls: uk-animation-fade">
            <Logo />
       <div className="uk-text-center uk-margin-large-top">
                    {/* Subdomain Not Found */}
                  <div className="uk-margin-bottom">
                    <span data-uk-icon="icon: warning; ratio: 3" className="uk-text-warning"></span>
                  </div>
                  <h1 className="uk-heading-small uk-margin-remove-bottom uk-text-danger">
                    Workspace Not Found
                  </h1>
                  <p className="uk-text-lead uk-margin-small-top uk-text-muted">
                    The workspace doesn't exist or is no longer available.
                  </p>
            </div>
            {/* Help Section */}
            <div className="uk-text-center uk-margin-large-top">
              <div className="uk-text-small uk-text-muted">
                <p>Need help? <a href="mailto:support@yourdomain.com" className="uk-link-muted">Contact Support</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Div100vh>
  );

}

export default NotFound;