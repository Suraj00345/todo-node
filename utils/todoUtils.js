const todoDataValidation = ({todo})=>{
    return new promiseImpl((resolve, reject)=>{
        if(!todo) reject("Todo text is missing.");
        if(typeof todo !== "string") reject ("todo is not a text");
        if(todo.length < 3 || todo.length > 100){
            reject("Todo length should be 3-100 chars only");
        } else {
            resolve();
        }
    })
}


module.exports = todoDataValidation;