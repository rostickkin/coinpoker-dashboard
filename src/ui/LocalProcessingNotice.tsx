import './local-processing-notice.css';

export function LocalProcessingNotice({warning=false}:{warning?:boolean}){
 return <div className={'local-processing-notice'+(warning?' local-processing-warning':'')} role={warning?'note':undefined} aria-label={warning?'Local processing notice':undefined}>
  {warning&&<svg className="local-processing-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 22 21H2Z" fill="#f2c94c" stroke="#f2c94c" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 9v5" fill="none" stroke="#bd2438" strokeWidth="2.4" strokeLinecap="round"/><circle cx="12" cy="17.5" r="1.3" fill="#bd2438"/></svg>}
  <p><span className="local-processing-privacy">Your files stay on your device.</span>{' '}All calculations are performed automatically in your browser. Do not refresh the page after processing is complete, as this will clear the loaded data and results.</p>
 </div>;
}
