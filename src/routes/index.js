import { Router } from 'express';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import transMonitorRoutes from '../modules/transMonitor/transMonitor.routes.js';
import claimValidationRoutes from '../modules/claimValidation/claimValidation.routes.js';
import patientRoutes from '../modules/patient/patient.routes.js';
import payerRoutes from '../modules/payer/payer.routes.js';
import confRoutes from '../modules/conf/conf.routes.js';
import transactionAnalysisRoutes from '../modules/transactionAnalysis/transactionAnalysis.routes.js';
import transActionAnalysisRoutes from '../modules/trans-action-analysis/transActionAnalysis.routes.js';
import eligibilityRoutes from '../modules/eligibility/eligibility.routes.js';

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/transMonitor', transMonitorRoutes);
router.use('/claim-validation', claimValidationRoutes);
router.use('/patients', patientRoutes);
router.use('/payers', payerRoutes);
router.use('/conf', confRoutes);
router.use('/transaction-analysis', transActionAnalysisRoutes);
router.use('/transactionTimeline', transactionAnalysisRoutes);
router.use('/eligibility', eligibilityRoutes);

export default router;
