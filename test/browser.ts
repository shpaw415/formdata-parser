import parser from "../";

const formEl = document.querySelector("form")!;

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = parser(new FormData(formEl));
  console.log(data);
});
