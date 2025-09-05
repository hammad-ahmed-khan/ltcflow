import ltcFlowLogo from '../../../assets/flowlogo login300px.webp';
 
function Logo({ info = {} }) {
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

export default Logo;