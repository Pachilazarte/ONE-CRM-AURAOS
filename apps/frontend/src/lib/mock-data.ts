import type { CRMContact, Deal, Task, EmailThread, TeamUser } from './types';

export const MOCK_TEAM: TeamUser[] = [
  { id: '1', name: 'Admin Master',   email: 'admin@one.com',    role: 'admin',    isActive: true,  createdAt: '2026-01-10', lastActivity: 'Hace 5 min', leadsAssigned: 0  },
  { id: '2', name: 'Carlos Méndez',  email: 'carlos@one.com',   role: 'vendedor', isActive: true,  createdAt: '2026-01-15', lastActivity: 'Hace 2 h',  leadsAssigned: 14 },
  { id: '3', name: 'Ana Rodríguez',  email: 'ana@one.com',      role: 'vendedor', isActive: true,  createdAt: '2026-02-01', lastActivity: 'Hace 1 día', leadsAssigned: 9  },
  { id: '4', name: 'Lucía Fernández',email: 'lucia@one.com',    role: 'vendedor', isActive: false, createdAt: '2026-03-20', lastActivity: 'Hace 3 días', leadsAssigned: 6  },
];

export const MOCK_CONTACTS: CRMContact[] = [
  { id: 'c1', name: 'Mariana Gutiérrez',  email: 'mariana@rrhh.solutions',  phone: '+54 11 5555-0101', company: 'RRHH Solutions S.A.',   status: 'hot',  leadScore: 87, assignedTo: 'Carlos Méndez',   lastActivity: 'Email enviado · hace 2 h',   createdAt: '2026-04-10', source: 'positivo_rrhh' },
  { id: 'c2', name: 'Fernando Sosa',      email: 'fsosa@talentgroup.ar',    phone: '+54 11 5555-0202', company: 'TalentGroup Argentina',  status: 'warm', leadScore: 62, assignedTo: 'Ana Rodríguez',    lastActivity: 'Llamada · hace 1 día',       createdAt: '2026-04-12', source: 'positivo_rrhh' },
  { id: 'c3', name: 'Valeria Peralta',    email: 'v.peralta@hrnetwork.com', phone: '+54 11 5555-0303', company: 'HR Network Consultora',  status: 'hot',  leadScore: 91, assignedTo: 'Carlos Méndez',   lastActivity: 'Propuesta vista · hace 3 h', createdAt: '2026-04-15', source: 'victoriadelaencinarrhh' },
  { id: 'c4', name: 'Rodrigo Castillo',   email: 'r.castillo@selectaHR.ar', phone: '+54 341 555-0404', company: 'Selecta RRHH Rosario',   status: 'cold', leadScore: 35, assignedTo: 'Ana Rodríguez',    lastActivity: 'Registrado · hace 4 días',   createdAt: '2026-04-20', source: 'positivo_rrhh' },
  { id: 'c5', name: 'Daniela Vega',       email: 'daniela.vega@buenoshr.com',phone: '+54 11 5555-0505',company: 'BuenosHR Consulting',    status: 'warm', leadScore: 58, assignedTo: 'Carlos Méndez',   lastActivity: 'Email abierto · ayer',       createdAt: '2026-04-22', source: 'victoriadelaencinarrhh' },
  { id: 'c6', name: 'Ignacio Torres',     email: 'itorres@hrplus.com.ar',   phone: '+54 11 5555-0606', company: 'HR Plus Group',          status: 'hot',  leadScore: 79, assignedTo: 'Ana Rodríguez',    lastActivity: 'Reunión agendada · hoy',     createdAt: '2026-04-25', source: 'positivo_rrhh' },
  { id: 'c7', name: 'Cecilia Romano',     email: 'cecilia@consultarrrhh.ar',phone: '+54 11 5555-0707', company: 'Consultar RRHH',         status: 'cold', leadScore: 28, assignedTo: 'Carlos Méndez',   lastActivity: 'Registrado · hace 1 semana', createdAt: '2026-05-01', source: 'positivo_rrhh' },
  { id: 'c8', name: 'Martín Blanco',      email: 'm.blanco@talentbridge.ar',phone: '+54 11 5555-0808', company: 'TalentBridge LATAM',     status: 'warm', leadScore: 65, assignedTo: 'Ana Rodríguez',    lastActivity: 'Propuesta enviada · ayer',   createdAt: '2026-05-05', source: 'victoriadelaencinarrhh' },
];

export const MOCK_DEALS: Deal[] = [
  { id: 'd1', contactName: 'Mariana Gutiérrez',  contactId: 'c1', amount: 18500, stage: 'propuesta',   probability: 65, assignedTo: 'Carlos Méndez',  expectedClose: '2026-05-30', createdAt: '2026-04-10' },
  { id: 'd2', contactName: 'Valeria Peralta',    contactId: 'c3', amount: 24000, stage: 'recontactos', probability: 80, assignedTo: 'Carlos Méndez',  expectedClose: '2026-05-25', createdAt: '2026-04-15' },
  { id: 'd3', contactName: 'Fernando Sosa',      contactId: 'c2', amount: 11200, stage: 'respuestas',  probability: 40, assignedTo: 'Ana Rodríguez',  expectedClose: '2026-06-10', createdAt: '2026-04-20' },
  { id: 'd4', contactName: 'Ignacio Torres',     contactId: 'c6', amount: 9800,  stage: 'contactado',  probability: 25, assignedTo: 'Ana Rodríguez',  expectedClose: '2026-06-20', createdAt: '2026-04-25' },
  { id: 'd5', contactName: 'Daniela Vega',       contactId: 'c5', amount: 15000, stage: 'nuevo',       probability: 10, assignedTo: 'Carlos Méndez',  expectedClose: '2026-07-01', createdAt: '2026-05-05' },
  { id: 'd6', contactName: 'Martín Blanco',      contactId: 'c8', amount: 32000, stage: 'propuesta',   probability: 60, assignedTo: 'Ana Rodríguez',  expectedClose: '2026-05-28', createdAt: '2026-05-05' },
  { id: 'd7', contactName: 'Tech HR Global',     contactId: 'x1', amount: 45000, stage: 'ganado',      probability: 100,assignedTo: 'Carlos Méndez',  expectedClose: '2026-04-30', createdAt: '2026-03-15' },
  { id: 'd8', contactName: 'Cecilia Romano',     contactId: 'c7', amount: 6500,  stage: 'perdido',     probability: 0,  assignedTo: 'Ana Rodríguez',  expectedClose: '2026-04-15', createdAt: '2026-04-01' },
  { id: 'd9', contactName: 'Rodrigo Castillo',   contactId: 'c4', amount: 13000, stage: 'nuevo',       probability: 10, assignedTo: 'Ana Rodríguez',  expectedClose: '2026-07-15', createdAt: '2026-05-10' },
];

export const MOCK_TASKS: Task[] = [
  { id: 't1', title: 'Llamar a Mariana para seguimiento de propuesta', dueDate: '2026-05-18', contactName: 'Mariana Gutiérrez', contactId: 'c1', assignedTo: 'Carlos Méndez',  completed: false, priority: 'high'   },
  { id: 't2', title: 'Enviar caso de éxito a Valeria Peralta',         dueDate: '2026-05-18', contactName: 'Valeria Peralta',   contactId: 'c3', assignedTo: 'Carlos Méndez',  completed: false, priority: 'high'   },
  { id: 't3', title: 'Confirmar reunión con Ignacio Torres',            dueDate: '2026-05-18', contactName: 'Ignacio Torres',    contactId: 'c6', assignedTo: 'Ana Rodríguez',  completed: true,  priority: 'medium' },
  { id: 't4', title: 'Revisar propuesta de Martín Blanco',             dueDate: '2026-05-19', contactName: 'Martín Blanco',     contactId: 'c8', assignedTo: 'Ana Rodríguez',  completed: false, priority: 'high'   },
  { id: 't5', title: 'Seguimiento email Fernando Sosa',                dueDate: '2026-05-19', contactName: 'Fernando Sosa',     contactId: 'c2', assignedTo: 'Ana Rodríguez',  completed: false, priority: 'medium' },
  { id: 't6', title: 'Actualizar precios en propuesta Q2',             dueDate: '2026-05-20', contactName: undefined, contactId: undefined, assignedTo: 'Carlos Méndez', completed: false, priority: 'low' },
  { id: 't7', title: 'Contactar nuevos prospectos de extracción',       dueDate: '2026-05-21', contactName: undefined, contactId: undefined, assignedTo: 'Ana Rodríguez',  completed: false, priority: 'medium' },
  { id: 't8', title: 'Cerrar deal con Valeria — última reunión',       dueDate: '2026-05-25', contactName: 'Valeria Peralta',   contactId: 'c3', assignedTo: 'Carlos Méndez',  completed: false, priority: 'high'   },
];

export const MOCK_EMAILS: EmailThread[] = [
  {
    id: 'e1', contactName: 'Valeria Peralta', contactEmail: 'v.peralta@hrnetwork.com',
    subject: 'Re: Propuesta plataforma ONE CRM – RRHH Network', preview: 'Gracias por enviar la propuesta. Revisé los números y me parecen muy competitivos...', date: 'Hace 3 h', unread: true, direction: 'in',
    messages: [
      { id: 'm1', from: 'carlos@one.com', to: 'v.peralta@hrnetwork.com', date: 'Ayer 15:30', body: 'Hola Valeria, adjunto nuestra propuesta detallada para el módulo de gestión de candidatos. Los precios incluyen onboarding y 3 meses de soporte prioritario. ¿Tenés disponibilidad esta semana para una demo final?' },
      { id: 'm2', from: 'v.peralta@hrnetwork.com', to: 'carlos@one.com', date: 'Hoy 09:15', body: 'Gracias por enviar la propuesta. Revisé los números y me parecen muy competitivos. Me gustaría reunirnos el jueves a las 11 hs. ¿Te funciona? Adicionalmente, ¿podrían incluir capacitación para 5 usuarios?' },
    ],
  },
  {
    id: 'e2', contactName: 'Mariana Gutiérrez', contactEmail: 'mariana@rrhh.solutions',
    subject: 'Consulta sobre módulo de automatizaciones', preview: 'Hola Carlos, quería consultarte si el módulo de automatizaciones incluye envío de emails masivos...', date: 'Hace 5 h', unread: true, direction: 'in',
    messages: [
      { id: 'm3', from: 'mariana@rrhh.solutions', to: 'carlos@one.com', date: 'Hoy 07:45', body: 'Hola Carlos, quería consultarte si el módulo de automatizaciones incluye envío de emails masivos a listas segmentadas. También me interesa saber si tienen integración con LinkedIn.' },
    ],
  },
  {
    id: 'e3', contactName: 'Fernando Sosa', contactEmail: 'fsosa@talentgroup.ar',
    subject: 'Seguimiento reunión del martes', preview: 'Te envío el resumen de lo que hablamos, más detalles de nuestros módulos disponibles...', date: 'Ayer', unread: false, direction: 'out',
    messages: [
      { id: 'm4', from: 'carlos@one.com', to: 'fsosa@talentgroup.ar', date: 'Ayer 10:00', body: 'Hola Fernando, te envío el resumen de lo que hablamos más información detallada de nuestros módulos. El CRM incluye pipeline de ventas, gestión de contactos, automatizaciones y bandeja de emails integrada. ¿Cuándo podemos agendar una demo?' },
    ],
  },
  {
    id: 'e4', contactName: 'Ignacio Torres', contactEmail: 'itorres@hrplus.com.ar',
    subject: 'Confirmación demo – HR Plus Group', preview: 'Confirmo la demo para mañana a las 10 hs. Estaremos presentes Ignacio y 2 personas más del equipo...', date: 'Hace 1 día', unread: false, direction: 'in',
    messages: [
      { id: 'm5', from: 'ana@one.com', to: 'itorres@hrplus.com.ar', date: 'Hace 2 días 16:00', body: 'Hola Ignacio, quería confirmar si podemos avanzar con la demo para esta semana. Tenemos disponibilidad mañana a las 10 o el jueves a las 15. ¿Cuál te viene mejor?' },
      { id: 'm6', from: 'itorres@hrplus.com.ar', to: 'ana@one.com', date: 'Hace 1 día 09:30', body: 'Confirmo la demo para mañana a las 10 hs. Estaremos presentes Ignacio y 2 personas más del equipo de selección. Por favor enviar link de videollamada.' },
    ],
  },
];
