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
 ['terim','Fatih Terim','press',5],['jesus','Jorge Jesus','transition',3],
 ['di-matteo','Roberto Di Matteo','discipline',2],['keller','Jens Keller','development',1],
 ['okan-buruk','Okan Buruk','press',4],['emre-belozoglu','Emre Belözoğlu','transition',2],
 ['frank-de-boer','Frank de Boer','passing',1],['gerrard','Steven Gerrard','development',1],
 ['sergen-yalcin','Sergen Yalçın','passing',2],['ismail-kartal','İsmail Kartal','discipline',2],
 ['conte','Antonio Conte','defense',4],['tuchel','Thomas Tuchel','press',4],
 ['luis-enrique','Luis Enrique','passing',4],['pochettino','Mauricio Pochettino','press',3],
 ['senol-gunes','Şenol Güneş','development',3],['aykut-kocaman','Aykut Kocaman','defense',3],
 // Genişletilmiş havuz: yeni uzmanlıklar (attack, fitness) ve farklı dönemlerden hocalar.
 ['alex-ferguson','Alex Ferguson','attack',5],['jupp-heynckes','Jupp Heynckes','fitness',5],
 ['fabio-capello','Fabio Capello','discipline',4],['hansi-flick','Hansi Flick','attack',4],
 ['xabi-alonso','Xabi Alonso','passing',4],['simone-inzaghi','Simone Inzaghi','transition',4],
 ['didier-deschamps','Didier Deschamps','defense',4],['mircea-lucescu','Mircea Lucescu','development',4],
 ['mikel-arteta','Mikel Arteta','press',3],['arne-slot','Arne Slot','passing',3],
 ['julian-nagelsmann','Julian Nagelsmann','transition',3],['roberto-mancini','Roberto Mancini','discipline',3],
 ['abdullah-avci','Abdullah Avcı','fitness',3],['vincenzo-montella','Vincenzo Montella','attack',3],
 ['maurizio-sarri','Maurizio Sarri','passing',2],['ruben-amorim','Rúben Amorim','fitness',2],
 ['erik-ten-hag','Erik ten Hag','development',2],['ange-postecoglou','Ange Postecoglou','attack',2],
 ['ersun-yanal','Ersun Yanal','attack',1],['mustafa-denizli','Mustafa Denizli','discipline',1]
].map(([id,name,specialty,stars])=>({id:'coach-'+id,name,specialty,stars,kind:'coach'}));
