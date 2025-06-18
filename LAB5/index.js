const express = require("express");
const path = require('path');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const app = express();
const fs = require("fs").promises;

app.use('/image', express.static(path.join(__dirname, 'image')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({ extended: true }));

async function getDBConnection() {
    const db = await sqlite.open({
        filename : 'product.db',
        driver : sqlite3.Database
    });
    return db;
}

async function makeData(rows) {
  const movieHTML = rows.map((movie) => `
    <section>
      <a href="/movies/${movie.movie_id}" style="text-decoration: none;">
        <img src="/image/${movie.movie_image}" alt="${movie.movie_title}">
        <h2>${movie.movie_title}</h2>
        <p>개봉일: ${movie.movie_release_date}</p>
        <p>평점: ${movie.movie_rate} / 10</p>
        <div>줄거리: <br> ${movie.movie_overview}</div>
      </a>
    </section>
  `).join('');
  return movieHTML;
}

app.get(['/', '/index/html'], async (req, res) => {
  try {
    const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf-8');
    const db = await getDBConnection();

    const searchTerm = req.query.searchTerm || '';
    const sort = req.query.sort || '';

    let conditions = [];
    let params = [];

    // 검색어
    if (searchTerm) {
      conditions.push('movie_title LIKE ?');
      params.push(`%${searchTerm}%`);
    }

    // sql문 만들기
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 정렬 기준
    let orderClause = '';
    switch (sort) {
      case 'rate_desc':
        orderClause = 'ORDER BY movie_rate DESC';
        break;
      case 'rate_asc':
        orderClause = 'ORDER BY movie_rate ASC';
        break;
      case 'release_desc':
        orderClause = 'ORDER BY movie_release_date DESC';
        break;
      case 'release_asc':
        orderClause = 'ORDER BY movie_release_date ASC';
        break;
      default:
        orderClause = '';
    }

    const sql = `SELECT * FROM movie ${whereClause} ${orderClause}`;
    const data = await db.all(sql, params);

    const movieHTML = await makeData(data);

    const resultHTML = html.replace(
      /<main>(.*?)<\/main>/s,
      `<main>\n${movieHTML}\n</main>`
    );

    await db.close();
    res.send(resultHTML);

  } 
  catch (e) {
    res.sendStatus(400);
  }
});

app.get('/login', async (req, res) => {
  try {
    const html = await fs.readFile(path.join(__dirname, 'login.html'), 'utf-8');
    res.send(html);
  } 
  catch (e) {
    res.sendStatus(500);
  }
});

app.get('/signup', async (req, res) => {
  try {
    const html = await fs.readFile(path.join(__dirname, 'signup.html'), 'utf-8');
    res.send(html);
  } 
  catch (e) {
    res.sendStatus(500);
  }
});

app.get("/movies/:movie_id", async (req, res) => {
  try {
    let db = await getDBConnection();
    const html = await fs.readFile(path.join(__dirname, 'movie.html'), 'utf-8');

    const movie_id = req.params.movie_id;
    const movie = await db.get("SELECT * FROM movie WHERE movie_id = ?", [movie_id]);
      
    let resultHTML = html.replace(
      /<div class="moviedata">.*?<\/div>/s,

      `<div class="moviedata">
          <img src="/image/${movie.movie_image}" alt="${movie.movie_title}">
          <div class="textdata">
            <h4>영화 id: ${movie_id}</h4>
            <h2>${movie.movie_title}</h2>
            <p>개봉일: ${movie.movie_release_date}</p>
            <p>평점: ${movie.movie_rate} / 10</p>
            <div>줄거리: <br> ${movie.movie_overview}</div>
          </div>
      </div>`
    );

    let comment = await fs.readFile(path.join(__dirname, 'comment.json'), 'utf-8');
    comment = JSON.parse(comment);
    comment = comment[movie.movie_id - 1];

    let commentresult = '';
    for (let i of comment) {
      commentresult += `
      <p>${i.text}</p>
      `
    }
    
    resultHTML = resultHTML.replace(
      /<div class="comments">.*?<\/div>/s,
      `<div class="comments">
        ${commentresult}
        <form method="POST" action="/movies/${movie.movie_id}" style="margin-bottom: 50px; margin-left: 1px;">
          <input type="text" name="newcomment" id="newcomment">
          <button type="submit">등록하기!</button>
        </form>
      </div>`
    );
    
    res.send(resultHTML); 

  }
  catch (e) {
    res.sendStatus(400);
  }
});


app.post("/movies/:movie_id", async (req, res) => {
  const movie_id = parseInt(req.params.movie_id);
  const newComment = req.body.newcomment;

  try {
    const commentPath = path.join(__dirname, 'comment.json');
    let commentData = await fs.readFile(commentPath, 'utf-8');
    let comments = JSON.parse(commentData);

    comments[movie_id - 1].push({ text: newComment });
    await fs.writeFile(commentPath, JSON.stringify(comments), 'utf-8');
    res.redirect(`/movies/${movie_id}`);
  } 
  catch (err) {
    res.status(500);
  }

});

app.listen(3000, () => {
  console.log(`http://localhost:3000 에서 실행 중`);
});
