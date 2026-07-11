import { mountAgentOffice } from 'virtual:agent-office-entry';
import './styles.css';

const root = document.querySelector('#root');
if (root === null) throw new Error('Agent Office root element is missing');

mountAgentOffice(root);
