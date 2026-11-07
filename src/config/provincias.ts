// Las 13 provincias de la región Puno, con las palabras que las identifican en el texto de una nota.

export interface Provincia {
  clave: string
  nombre: string
  capital: string
  palabras: string[] // en minúsculas y sin tildes
}

export const PROVINCIAS: Provincia[] = [
  { clave: 'puno', nombre: 'Puno', capital: 'Puno', palabras: ['ciudad de puno', 'provincia de puno', 'puno ciudad', 'uros', 'chucuito puno', 'acora', 'atuncolla', 'capachica', 'coata', 'huata', 'manazo', 'paucarcolla', 'pichacani', 'platería', 'plateria', 'tiquillaca', 'vilque', 'amantani', 'taquile', 'bahia de puno', 'parque pino', 'jr. lima'] },
  { clave: 'san-roman', nombre: 'San Román', capital: 'Juliaca', palabras: ['juliaca', 'san roman', 'caracoto', 'cabana', 'cabanillas', 'san miguel'] },
  { clave: 'azangaro', nombre: 'Azángaro', capital: 'Azángaro', palabras: ['azangaro', 'asillo', 'muñani', 'munani', 'potoni', 'saman', 'san anton', 'tirapata', 'arapa', 'chupa', 'jose domingo choquehuanca'] },
  { clave: 'melgar', nombre: 'Melgar', capital: 'Ayaviri', palabras: ['ayaviri', 'melgar', 'santa rosa de melgar', 'nuñoa', 'nunoa', 'orurillo', 'macari', 'umachiri', 'llalli', 'cupi'] },
  { clave: 'el-collao', nombre: 'El Collao', capital: 'Ilave', palabras: ['ilave', 'el collao', 'pilcuyo', 'santa rosa de mazocruz', 'mazocruz', 'conduriri', 'capazo'] },
  { clave: 'chucuito', nombre: 'Chucuito', capital: 'Juli', palabras: ['juli ', 'juli,', 'juli.', 'chucuito', 'pomata', 'zepita', 'desaguadero', 'kelluyo', 'huacullani', 'pisacoma'] },
  { clave: 'yunguyo', nombre: 'Yunguyo', capital: 'Yunguyo', palabras: ['yunguyo', 'copani', 'ollaraya', 'anapia', 'cuturapi', 'unicachi', 'tinicachi'] },
  { clave: 'huancane', nombre: 'Huancané', capital: 'Huancané', palabras: ['huancane', 'taraco', 'vilquechico', 'pusi', 'rosaspata', 'cojata', 'inchupalla', 'huatasani'] },
  { clave: 'moho', nombre: 'Moho', capital: 'Moho', palabras: ['moho', 'conima', 'tilali', 'huayrapata'] },
  { clave: 'putina', nombre: 'San Antonio de Putina', capital: 'Putina', palabras: ['putina', 'la rinconada', 'rinconada', 'ananea', 'quilcapuncu', 'sina'] },
  { clave: 'lampa', nombre: 'Lampa', capital: 'Lampa', palabras: ['lampa', 'pucara', 'santa lucia', 'paratia', 'vilavila', 'ocuviri', 'nicasio', 'calapuja', 'palca'] },
  { clave: 'carabaya', nombre: 'Carabaya', capital: 'Macusani', palabras: ['macusani', 'carabaya', 'crucero', 'san gaban', 'ayapata', 'ituata', 'corani', 'ollachea', 'coasa', 'usicayos', 'ajoyani'] },
  { clave: 'sandia', nombre: 'Sandia', capital: 'Sandia', palabras: ['sandia', 'san juan del oro', 'yanahuaya', 'alto inambari', 'cuyocuyo', 'patambuco', 'phara', 'limbani', 'quiaca', 'massiapo'] },
]

export const provinciaPorClave = (c?: string) => PROVINCIAS.find((p) => p.clave === c)
