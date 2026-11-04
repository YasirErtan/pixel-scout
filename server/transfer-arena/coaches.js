// Stars and specialties are designed game effects, not EA ratings or factual rankings.
// Identity references: UEFA's 2012 and 2014 elite club coaches forum lists.
export const COACH_SOURCES=[
 'https://pt.uefa.com/news-media/news/0253-0d04030e694c-670d17f80c6a-1000--midweek-meeting-for-europe-s-elite-club-coaches/',
 'https://ru.uefa.com/news-media/news/0253-0d041ff7ab79-2a8dc8553ded-1000--club-coaches-attend-uefa-forum/'
];
export const COACHES=[
 ['klopp','Jürgen Klopp','press',5],['guardiola','Pep Guardiola','passing',5],
 ['mourinho','José Mourinho','defense',5],['ancelotti','Carlo Ancelotti','discipline',5],
 ['simeone','Diego Simeone','defense',4],['emery','Unai Emery','transition',4],
 ['wenger','Arsène Wenger','development',5],['benitez','Rafael Benítez','defense',3],
 ['terim','Fatih Terim','press',3],['jesus','Jorge Jesus','transition',3],
 ['di-matteo','Roberto Di Matteo','discipline',2],['keller','Jens Keller','development',1]
].map(([id,name,specialty,stars])=>({id:'coach-'+id,name,specialty,stars,kind:'coach'}));
